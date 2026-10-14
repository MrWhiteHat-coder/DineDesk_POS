"""
Legacy duplicate order-number report — READ-ONLY dry run. There is NO --apply.

Purpose (residual risk from Batch-2 FIX 2):
  The unique (restaurant_id, order_number) index is deliberately NOT created
  while legacy duplicates exist (server.py logs them at startup). This script
  gives operators the exact evidence to resolve collisions manually.

This script NEVER modifies the database:
  • no renumbering — order numbers may be referenced on printed receipts,
    settlements and external platform records;
  • no deletion — duplicates are financial records until proven otherwise.

Usage:
  python scripts/check_order_number_duplicates.py            # full report
  python scripts/check_order_number_duplicates.py --json     # machine-readable
  python scripts/check_order_number_duplicates.py -r <restaurant_id>

Exit codes:
  0  no duplicates (safe to let the app create the unique index on startup)
  2  duplicates still exist (resolve manually; the unique index stays off)

Manual resolution process (see docs/P0_STABILIZATION.md):
  1. Review each duplicate group below: same restaurant, same order_number,
     but different order ids. For each group pick the LEGITIMATE order
     (earliest created_at / carry the financial records: payments/wallet
     rows/paid status usually identify it).
  2. If one doc is provably a re-creation artifact (e.g. a webhook retry with
     the same day-number), correct THAT doc's order_number to an unused value
     of the same day sequence by hand (insert a throwaway 0.0-value doc or
     bump counters manually — verify first via this report).
  3. Re-run this script until it reports clean. The app will then create the
     unique index at its next startup automatically.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env"), override=True)

MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME", "dinedesk_pos")


async def report(restaurant_id=None, as_json=False):
    import json
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # 1. Is the unique index even active?
    indexes = await db.orders.index_information()
    unique_active = any(
        idx.get("unique") and [k[0] for k in idx.get("key", [])] == ["restaurant_id", "order_number"]
        for idx in indexes.values())

    # 2. Aggregate duplicate groups (read-only).
    match = ({"restaurant_id": restaurant_id} if restaurant_id else {})
    pipeline = [
        {"$group": {"_id": {"restaurant_id": "$restaurant_id",
                            "order_number": "$order_number"},
                    "n": {"$sum": 1},
                    "ids": {"$push": "$id"}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$sort": {"_id.restaurant_id": 1, "_id.order_number": 1}},
    ]
    grouped = [g async for g in db.orders.aggregate(pipeline, allowDiskUse=True)]
    groups = []
    for g in grouped:
        docs = [d async for d in db.orders.find(
            {"id": {"$in": g["ids"]}, **match},
            {"_id": 0, "id": 1, "order_number": 1, "created_at": 1, "status": 1,
             "payment_status": 1, "payment_method": 1, "total_amount": 1,
             "platform": 1, "created_by": 1}).to_list(len(g["ids"]))]
        groups.append({"restaurant_id": g["_id"]["restaurant_id"],
                       "order_number": g["_id"]["order_number"],
                       "count": g["n"], "orders": docs})

    if as_json:
        print(json.dumps({"unique_index_active": unique_active,
                          "duplicate_groups": groups}, indent=2, default=str))
    else:
        print("=" * 78)
        print("LEGACY DUPLICATE ORDER-NUMBER REPORT (dry run, nothing modified)")
        print(f"Unique (restaurant_id, order_number) index active: {unique_active}")
        print("=" * 78)
        if not groups:
            print("✅ No duplicate order numbers. The app will create the unique")
            print("   index automatically on next startup — nothing to do.")
        for g in groups:
            print(f"\nrestaurant={g['restaurant_id']}  order_number={g['order_number']}"
                  f"  count={g['count']}")
            for d in g["orders"]:
                print(f"  id={d.get('id')}  created={d.get('created_at')}"
                      f"  status={d.get('status')}  payment={d.get('payment_status')}"
                      f"/{d.get('payment_method')}  total=₹{d.get('total_amount')}"
                      f"  platform={d.get('platform')}")
            print("  → Decide the legitimate record (usually the earliest or the one")
            print("    carrying payments); renumber the OTHER copy by hand. See")
            print("    docs/P0_STABILIZATION.md § duplicate order numbers.")
        print()
        total = len(groups)
        print(f"Summary: {total} duplicate group(s).")
    return 0 if not groups else 2


def main():
    ap = argparse.ArgumentParser(description="Report legacy duplicate order numbers (read-only).")
    ap.add_argument("-r", "--restaurant", help="restrict to one restaurant_id")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()
    try:
        sys.exit(asyncio.run(report(args.restaurant, args.json)))
    except Exception as e:
        # No DB reachable/reporting env — say so explicitly, never fake success.
        print(f"Could not run the duplicate scan against {MONGO_URL!r}: {e}")
        sys.exit(3)


if __name__ == "__main__":
    main()
