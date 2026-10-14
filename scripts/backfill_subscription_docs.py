"""
Subscription-document backfill — DRY-RUN by default, explicit `--apply` required.

Purpose (residual risk from the Batch 1 entitlement gate):
  The server-side entitlement gate (server.require_addon) requires one
  restaurant_subscriptions doc per tenant. Docs are currently created by
  (a) the demo seed and (b) POST /api/store/subscribe. Tenants created
  before those existed may have NO doc. A missing doc behaves as
  "no add-ons" (403 on gated modules) — it never crashes — but the Store
  UI and downstream billing flows expect the doc to exist.

Rules (evidence-based — no paid add-on is ever invented):
  1. Tenant WITHOUT a doc:
       → create {restaurant_id, active_addons: [], plan: "starter"}.
         Nothing is activated. If the tenant has genuinely purchased add-ons,
         the operator re-activates them explicitly from the Store/billing
         evidence — this script will not guess.
       EXCEPTION: the demo tenant defined by ENABLE_DEMO_ACCOUNT + DEMO_EMAIL —
       its entitlement came from the demo seed, so its doc is restored to all
       STORE_ADDONS ids only when the demo user actually exists.
  2. Tenant WITH a doc: legacy add-on ids are normalized to the authoritative
       STORE_ADDONS catalog ("branches"→"multi_branch", "analytics"→
       "analytics_pro"). Unknown/non-catalog entries are LEFT UNTOUCHED and
       listed in the report for human review — never silently dropped.

Idempotency: keyed upsert by restaurant_id; re-running converges to the same
state; no docs are deleted or duplicated.

Usage:
  python scripts/backfill_subscription_docs.py            # dry run (plan only)
  python scripts/backfill_subscription_docs.py --apply    # actually write
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env"))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "dinedesk_pos")

# Mirrors server.STORE_ADDONS ids (single source of truth in server.py)
CATALOG_ADDONS = {
    "crm_loyalty", "inventory", "whatsapp", "multi_branch",
    "analytics_pro", "api_access", "custom_branding", "gift_cards",
}
# Legacy gate slugs (pre-catalog) → catalog ids
LEGACY_MAP = {"branches": "multi_branch", "analytics": "analytics_pro"}


async def backfill(apply: bool):
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    restaurants = {r["id"]: r async for r in
                   db.restaurants.find({}, {"_id": 0, "id": 1, "name": 1})}
    subs = {(s.get("restaurant_id") if "restaurant_id" in s else s.get("id")): s
            async for s in db.restaurant_subscriptions.find({})}

    demo_email = os.environ.get("DEMO_EMAIL", "demo@dinedesk.in")
    demo_user = await db.users.find_one({"email": demo_email}, {"restaurant_id": 1})
    demo_rid = (demo_user or {}).get("restaurant_id")
    demo_enabled = os.environ.get("ENABLE_DEMO_ACCOUNT", "false").lower() in ("true", "1", "yes")
    now = datetime.now(timezone.utc).isoformat()

    created = normalized = skipped_unknown = 0
    actions = []
    for rid, r in restaurants.items():
        sub = subs.get(rid)
        if not sub:
            is_demo = (rid == demo_rid and demo_enabled)
            active_addons = list(CATALOG_ADDONS) if is_demo else []
            plan = "starter"
            actions.append(("CREATE", rid, r.get("name", "?"),
                            f"active_addons={active_addons} "
                            f"({'demo restore' if is_demo else 'empty — no paid add-ons inferred'})"))
            if apply:
                await db.restaurant_subscriptions.update_one(
                    {"restaurant_id": rid},
                    {"$set": {"restaurant_id": rid, "active_addons": active_addons,
                              "plan": plan, "updated_at": now}},
                    upsert=True,
                )
            created += 1
            continue

        # Legacy-slug normalization on the EXISTING doc
        current = sub.get("active_addons", []) or []
        new_list, changed = [], False
        review = []
        for a in current:
            if a in CATALOG_ADDONS:
                new_list.append(a)
            elif a in LEGACY_MAP:
                new_list.append(LEGACY_MAP[a])
                changed = True
            else:
                review.append(a)
        if changed:
            actions.append(("NORMALIZE", rid, r.get("name", "?"),
                            f"{current} → {new_list}" + (f" (manual review: {review})" if review else "")))
            if apply:
                await db.restaurant_subscriptions.update_one(
                    {"restaurant_id": rid},
                    {"$set": {"active_addons": new_list, "updated_at": now}},
                )
            normalized += 1
        elif review:
            actions.append(("REVIEW", rid, r.get("name", "?"),
                            f"unknown add-on ids kept untouched: {review}"))
            skipped_unknown += 1

    print(f"\n=== Subscription-doc backfill {'APPLIED' if apply else 'DRY RUN'} "
          f"({MONGO_URL}/{DB_NAME}) ===")
    for kind, rid, name, detail in actions:
        print(f"[{kind:9}] {name} ({rid}): {detail}")
    print(f"\nSummary: {created} doc(s) to create, {normalized} doc(s) to normalize, "
          f"{skipped_unknown} doc(s) need manual review, "
          f"{len(restaurants)} restaurant(s) scanned, {len(subs)} existing doc(s).")
    if not apply:
        print("DRY RUN ONLY — nothing was written. Re-run with --apply to write.")
    client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Actually write changes (default: dry run)")
    args = ap.parse_args()
    asyncio.run(backfill(apply=args.apply))
