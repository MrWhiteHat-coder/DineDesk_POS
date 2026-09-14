"""
DineDesk Intelligence — one shared service that powers AI Insights,
Ask DineDesk and the Day-Close PDF summary.

Core rule: the backend computes every number first (real orders, real
inventory). Gemini only explains and suggests from a verified fact sheet —
it is never asked to "find something" in raw data and never allowed to
invent figures. Where data is missing (waste, expenses) we simply do not
fabricate insights.

AI suggestions are advisory only: nothing here mutates menu, inventory,
recipes, combos or purchase orders.
"""

import asyncio
import os
import logging
from datetime import datetime, timedelta, timezone
from collections import Counter

logger = logging.getLogger("uvicorn.error")

try:
    import google.generativeai as genai
    _GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
    if _GEMINI_KEY:
        genai.configure(api_key=_GEMINI_KEY)
        GEMINI_READY = True
    else:
        GEMINI_READY = False
except Exception:
    genai = None
    GEMINI_READY = False

# Env-overridable so a future deprecation is a Render env change, not a redeploy
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

# Simple in-process cache so analytics bursts don't burn Gemini quota.
_CACHE = {}
CACHE_TTL_SECONDS = 30 * 60


def _now():
    return datetime.now(timezone.utc)


def _parse(ts):
    try:
        d = datetime.fromisoformat(ts)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


# ────────────────────────────────────────────────────────────────────
# SNAPSHOT — every number the AI is allowed to mention lives here
# ────────────────────────────────────────────────────────────────────

async def compute_snapshot(db, restaurant_id: str) -> dict:
    """Compute all verified facts from real collections. No AI involved."""
    now = _now()
    d7_start = (now - timedelta(days=7)).isoformat()
    d14_start = (now - timedelta(days=14)).isoformat()

    orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "created_at": {"$gte": d14_start},
        "payment_status": "paid",
        "status": {"$nin": ["cancelled"]},
    }, {"_id": 0, "items": 1, "total_amount": 1, "created_at": 1,
        "order_type": 1, "payment_method": 1}).to_list(20000)

    last7, prev7 = [], []
    for o in orders:
        c = _parse(o.get("created_at"))
        if not c:
            continue
        (last7 if c >= _parse(d7_start) else prev7).append(o)

    # ---- Sales & orders trend ----
    s_last7 = round(sum(o["total_amount"] for o in last7), 2)
    s_prev7 = round(sum(o["total_amount"] for o in prev7), 2)
    sales_change = _pct(s_prev7, s_last7)

    # ---- Item-level: last 7d vs previous 7d ----
    last7_items, prev7_items = Counter(), Counter()
    last7_rev = Counter()
    for o in last7:
        for i in o.get("items", []):
            n = i.get("name")
            if n:
                last7_items[n] += i.get("quantity", 0)
                last7_rev[n] += i.get("total", 0)
    for o in prev7:
        for i in o.get("items", []):
            n = i.get("name")
            if n:
                prev7_items[n] += i.get("quantity", 0)

    movers = []
    for n, q in last7_items.items():
        pq = prev7_items.get(n, 0)
        if q + pq >= 5:  # ignore noise — need a handful of sales to judge
            movers.append({
                "name": n, "sold_last7": q, "sold_prev7": pq,
                "change_pct": _pct(pq, q), "revenue_last7": round(last7_rev[n], 2),
            })
    movers.sort(key=lambda m: -abs(m["change_pct"] or 0))
    risers = [m for m in movers if (m["change_pct"] or 0) >= 15][:5]
    decliners = [m for m in movers if (m["change_pct"] or 0) <= -15][:5]

    # ---- Combo pairs (same-order basket analysis, last 14d) ----
    pair_counts = Counter()
    single_counts = Counter()
    for o in orders:
        names = sorted({i.get("name") for i in o.get("items", []) if i.get("name")})
        for n in names:
            single_counts[n] += 1
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                pair_counts[(names[i], names[j])] += 1
    combos = []
    for (a, b), c in pair_counts.most_common(50):
        if c >= 4 and c >= 0.25 * min(single_counts[a], single_counts[b]):
            combos.append({"items": [a, b], "orders": c})
        if len(combos) >= 3:
            break

    # ---- Hour pattern (restaurant-local handled upstream; UTC hours still rank) ----
    hour_orders = Counter()
    for o in last7:
        c = _parse(o.get("created_at"))
        if c:
            hour_orders[c.hour] += 1
    peak = [{"hour": h, "orders": c} for h, c in hour_orders.most_common(3)] if hour_orders else []

    # ---- AOV & mix ----
    n_last7 = len(last7)
    aov = round(s_last7 / n_last7, 2) if n_last7 else 0
    types = Counter(o.get("order_type", "unknown") for o in last7)
    pays = Counter(o.get("payment_method", "unknown") for o in last7)

    # ---- Inventory: burn-rate & days-left (recipe-aware consumption) ----
    inv_days = []
    try:
        inv_items = await db.inventory.find(
            {"restaurant_id": restaurant_id}, {"_id": 0}).to_list(500)
        menu = await db.menu_items.find(
            {"restaurant_id": restaurant_id},
            {"_id": 0, "name": 1, "recipe": 1, "is_available": 1}).to_list(500)
        # Units consumed last 7 days per inventory item, from recipes
        consumed = Counter()
        inv_by_id = {i["id"]: i for i in inv_items}
        for m in menu:
            for ing in (m.get("recipe") or []):
                iid = ing.get("inventory_item_id")
                inv = inv_by_id.get(iid)
                if inv:
                    consumed[iid] += (ing.get("quantity_needed") or 0) * last7_items.get(m["name"], 0)
        for inv in inv_items:
            weekly_burn = consumed.get(inv["id"], 0)
            days_left = (inv["quantity"] / (weekly_burn / 7)) if weekly_burn > 0 else None
            if days_left is not None and days_left <= 14 or inv.get("is_low_stock"):
                inv_days.append({
                    "name": inv["name"], "qty": round(inv["quantity"], 2),
                    "unit": inv.get("unit", ""), "days_left": round(days_left, 1) if days_left is not None else None,
                    "low": bool(inv.get("is_low_stock")),
                })
        inv_days.sort(key=lambda x: (x["days_left"] is None, x["days_left"] or 999))
        inv_days = inv_days[:5]
    except Exception as e:
        logger.warning(f"Inventory snapshot skipped: {e}")

    # ---- Gross margin proxy (recipe cost vs menu price, current items) ----
    margins = []
    try:
        full_menu = await db.menu_items.find(
            {"restaurant_id": restaurant_id},
            {"_id": 0, "name": 1, "price": 1, "recipe": 1}).to_list(500)
        cost_by_inv = {i["id"]: i.get("cost_per_unit", 0) for i in inv_items} if inv_items else {}
        for m in full_menu:
            recipe = m.get("recipe") or []
            if not recipe or not m.get("price"):
                continue
            cost = sum((ing.get("quantity_needed") or 0) * cost_by_inv.get(ing.get("inventory_item_id"), 0) for ing in recipe)
            if cost > 0:
                margins.append({
                    "name": m["name"], "price": m["price"],
                    "cost": round(cost, 2), "margin_pct": round((m["price"] - cost) / m["price"] * 100, 1),
                })
        margins.sort(key=lambda x: x["margin_pct"])
        low_margin = margins[:3]
        high_margin = margins[-3:][::-1]
    except Exception:
        low_margin, high_margin = [], []

    # ---- Last-7-days daily series (for the PDF & "why down" answers) ----
    daily_series = []
    for d in range(6, -1, -1):
        day = (now - timedelta(days=d))
        ds = day.replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        tot = round(sum(o["total_amount"] for o in orders
                        if ds <= (_parse(o.get("created_at")) or ds) < de), 2)
        cnt = sum(1 for o in orders if ds <= (_parse(o.get("created_at")) or ds) < de)
        daily_series.append({"date": ds.strftime("%Y-%m-%d"), "sales": tot, "orders": cnt})

    return {
        "restaurant_id": restaurant_id,
        "generated_at": now.isoformat(),
        "sales": {
            "last7": s_last7, "prev7": s_prev7, "change_pct": sales_change,
            "orders_last7": n_last7, "aov": aov,
            "order_types": dict(types), "payment_methods": dict(pays),
            "daily_series": daily_series,
        },
        "item_movers": {"risers": risers, "decliners": decliners},
        "combos": combos,
        "peak_hours": peak,
        "inventory": {"watch": inv_days},
        "margins": {"low": low_margin, "high": high_margin},
        "data_gaps": {"waste_tracking": False, "expenses": False},
    }


def _pct(old, new):
    """% change old→new, guarded against divide-by-zero. None = not computable."""
    if not old:
        return None if not new else None  # no baseline — refuse to invent %
    return round((new - old) / old * 100, 1)


# ────────────────────────────────────────────────────────────────────
# FACT SHEET — compact, numbered; every fact the AI may reference
# ────────────────────────────────────────────────────────────────────

def format_facts(snap: dict, scope: str = "insights") -> str:
    s = snap["sales"]
    lines = [
        f"Sales last 7 days: Rs.{s['last7']:,.2f} ({s['orders_last7']} orders, AOV Rs.{s['aov']:,.2f})",
        f"Sales previous 7 days: Rs.{s['prev7']:,.2f}",
        f"Change: {s['change_pct']}%" if s["change_pct"] is not None else "Change: not computable (no prior-week baseline)",
    ]
    for i, d in enumerate(s["daily_series"], 1):
        lines.append(f"F{i}: {d['date']} sales Rs.{d['sales']:,.2f}, {d['orders']} orders")

    lines.append("")
    for i, m in enumerate(snap["item_movers"]["risers"], 1):
        prev, chg = m.get("sold_prev7"), m.get("change_pct")
        cur = m.get("sold_last7", 0)
        if chg is not None and prev is not None:
            lines.append(f"R{i}: {m['name']} UP {chg}% ({prev}->{cur} sold, Rs.{m.get('revenue_last7', 0):,.2f} last 7d)")
        else:
            lines.append(f"R{i}: {m['name']} sold {cur} (Rs.{m.get('revenue_last7', 0):,.2f})")
    for i, m in enumerate(snap["item_movers"]["decliners"], 1):
        prev, chg = m.get("sold_prev7"), m.get("change_pct")
        cur = m.get("sold_last7", 0)
        if chg is not None and prev is not None:
            lines.append(f"D{i}: {m['name']} DOWN {abs(chg)}% ({prev}->{cur} sold)")
        else:
            lines.append(f"D{i}: {m['name']} sold {cur}")

    for i, c in enumerate(snap["combos"], 1):
        lines.append(f"C{i}: {c['items'][0]} + {c['items'][1]} ordered together in {c['orders']} orders")

    for i, p in enumerate(snap["peak_hours"], 1):
        lines.append(f"P{i}: busiest hour {p['hour']}:00 with {p['orders']} orders (7-day count)")

    for i, it in enumerate(snap["inventory"]["watch"], 1):
        dl = f"{it['days_left']} days left" if it["days_left"] is not None else "no recent consumption"
        lines.append(f"I{i}: {it['name']} stock {it['qty']}{it['unit']} — {dl}{' (LOW)' if it['low'] else ''}")

    for i, m in enumerate(snap["margins"]["high"], 1):
        lines.append(f"M{i}: {m['name']} margin {m['margin_pct']}% (price Rs.{m['price']:.0f}, est. cost Rs.{m['cost']:.0f})")
    for i, m in enumerate(snap["margins"]["low"], 1):
        lines.append(f"M- low: {m['name']} margin {m['margin_pct']}% (price Rs.{m['price']:.0f}, est. cost Rs.{m['cost']:.0f})")

    if snap["sales"]["order_types"]:
        lines.append(f"Mix: {snap['sales']['order_types']}")
    if snap["sales"]["payment_methods"]:
        lines.append(f"Payments: {snap['sales']['payment_methods']}")

    lines.append("")
    lines.append("NOTE: Waste and expense data are NOT tracked in DineDesk — never mention waste or net profit.")
    lines.append("If a number is not on this sheet, you do not know it. Never estimate, round up, or invent figures.")
    return "\n".join(lines)


# ────────────────────────────────────────────────────────────────────
# GEMINI — single shared wrapper for all three features
# ────────────────────────────────────────────────────────────────────

_SAFETY_RULES = (
    "STRICT RULES:\n"
    "1. Use ONLY numbers, item names and facts from the FACT SHEET. Never invent or extrapolate any figure.\n"
    "2. If the sheet lacks data for something, say you don't have enough data — do not guess.\n"
    "3. Suggestions are ADVISORY ONLY. Never say you changed anything; the owner decides.\n"
    "4. Waste and expenses are not tracked — never mention them.\n"
    "5. Keep it warm, simple, human — the owner is busy. Short sentences.\n"
)


async def gemini_explain(facts: str, task_prompt: str, max_words: int = 220, _err_box: list | None = None) -> str | None:
    """One call shape for all features. Returns None if Gemini unavailable.
    Pass _err_box=["..."] to capture the exception message for diagnostics."""
    if not GEMINI_READY:
        if _err_box is not None:
            _err_box.append("GEMINI_READY=False (missing key or SDK import failed)")
        return None
    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=(
                "You are DineDesk Intelligence, a calm expert restaurant analyst. "
                + _SAFETY_RULES
            ),
        )
        resp = await asyncio.to_thread(
            model.generate_content,
            f"{task_prompt}\n\nFACT SHEET (verified data):\n{facts}\n\nAnswer in under {max_words} words.",
        )
        return (resp.text or "").strip() or None
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        if _err_box is not None:
            _err_box.append(f"{type(e).__name__}: {str(e)[:180]}")
        return None


# ────────────────────────────────────────────────────────────────────
# FEATURE 1 — AI Insights (structured for the Analytics card list)
# ────────────────────────────────────────────────────────────────────

async def build_insights(db, restaurant_id: str, restaurant_name: str) -> dict:
    cache_key = f"insights:{restaurant_id}"
    hit = _cache_get(cache_key)
    if hit:
        return hit

    snap = await compute_snapshot(db, restaurant_id)
    facts = format_facts(snap)
    ai_text = await gemini_explain(
        facts,
        "Write the restaurant's weekly insight card. Use EXACTLY this structure:\n"
        "For each of the 3-5 most interesting findings, output:\n"
        "TAG: one of GROWTH | WATCH | OPPORTUNITY | STOCK\n"
        "TITLE: short finding headline\n"
        "DETAIL: 1-2 sentences with the exact numbers from the sheet\n"
        "SUGGESTION: one practical advisory step\n"
        "---\n"
        "Pick the findings with the strongest evidence in the sheet. "
        "If there is barely any data, output fewer cards, not weaker facts.",
        max_words=320,
    )
    result = {
        "insights": _parse_insight_cards(ai_text) if ai_text else _fallback_insight_cards(snap),
        "ai_generated": bool(ai_text),
        "snapshot_summary": _public_summary(snap),
    }
    _cache_set(cache_key, result)
    return result


def _parse_insight_cards(text: str) -> list:
    """Parse TAG/TITLE/DETAIL/SUGGESTION structured lines into cards."""
    cards = []
    cur = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        upper = line.upper()
        if upper.startswith("TAG:"):
            cur = {"tag": line[4:].strip().upper(), "title": "", "detail": "", "suggestion": ""}
        elif upper.startswith("TITLE:") and cur:
            cur["title"] = line[6:].strip()
        elif upper.startswith("DETAIL:") and cur:
            cur["detail"] = line[7:].strip()
        elif upper.startswith("SUGGESTION:") and cur:
            cur["suggestion"] = line[11:].strip()
            if cur.get("title"):
                cards.append(cur)
            cur = None
        elif cur and line:
            cur["detail"] += " " + line
    return cards[:5]


def _fallback_insight_cards(snap: dict) -> list:
    """Gemini down → still useful, purely computed cards."""
    cards = []
    s = snap["sales"]
    if s["change_pct"] is not None:
        cards.append({
            "tag": "GROWTH" if s["change_pct"] >= 0 else "WATCH",
            "title": f"Sales {'up' if s['change_pct'] >= 0 else 'down'} {abs(s['change_pct'])}% vs last week",
            "detail": f"Rs.{s['last7']:,.2f} vs Rs.{s['prev7']:,.2f} across {s['orders_last7']} orders.",
            "suggestion": "Compare your busy hours and staffing against last week.",
        })
    for m in snap["item_movers"]["risers"][:2]:
        cards.append({
            "tag": "GROWTH", "title": f"{m['name']} rising — {m['change_pct']}% up",
            "detail": f"{m['sold_prev7']} → {m['sold_last7']} sold week-over-week (Rs.{m['revenue_last7']:,.2f}).",
            "suggestion": f"Keep ingredients for {m['name']} stocked through the week.",
        })
    for m in snap["item_movers"]["decliners"][:1]:
        cards.append({
            "tag": "WATCH", "title": f"{m['name']} slowing — {abs(m['change_pct'])}% down",
            "detail": f"{m['sold_prev7']} → {m['sold_last7']} sold week-over-week.",
            "suggestion": "Check quality/consistency before considering a price or menu change.",
        })
    for c in snap["combos"][:1]:
        cards.append({
            "tag": "OPPORTUNITY", "title": f"{c['items'][0]} + {c['items'][1]} go together",
            "detail": f"Ordered in the same basket {c['orders']} times in 2 weeks.",
            "suggestion": "Try a combo price for this pair and watch uptake.",
        })
    for it in snap["inventory"]["watch"][:2]:
        dl_txt = f"~{it['days_left']} days left" if it["days_left"] is not None else "needs a reorder"
        cards.append({
            "tag": "STOCK", "title": f"{it['name']} {dl_txt}",
            "detail": f"Current stock {it['qty']}{it['unit']} based on recipe consumption.",
            "suggestion": "Raise a purchase order before it runs out.",
        })
    return cards[:5]


# ────────────────────────────────────────────────────────────────────
# FEATURE 2 — Ask DineDesk (question → intent → facts → answer)
# ────────────────────────────────────────────────────────────────────

INTENTS = {
    "yesterday": ["yesterday", "enna sale", "நேற்று"],
    "week": ["this week", "indha week", "weekly", "indha month", "this month", "month"],
    "best_seller": ["best selling", "best seller", "top item", "adhigama", "most sold", "popular"],
    "worst_seller": ["worst", "kammi", "slow", "not selling"],
    "peak": ["busiest", "peak", "rush", "crowded", "busy time"],
    "together": ["together", "combo", "pair", "same order"],
    "why_down": ["why", "kammi aagirukku", "down", "decline", "drop", "decrease"],
    "prep": ["prepare", "naalaikku", "tomorrow", "prep"],
    "stock": ["stock", "inventory", "finish", "aagum", "reorder"],
    "waste": ["waste", "wastage"],
}


def detect_intent(question: str) -> str:
    q = question.lower()
    if any(w in q for w in INTENTS["waste"]):
        return "waste"
    if any(w in q for w in INTENTS["together"]):
        return "together"
    if any(w in q for w in INTENTS["stock"]):
        return "stock"
    if any(w in q for w in INTENTS["best_seller"]):
        return "best_seller"
    if any(w in q for w in INTENTS["peak"]):
        return "peak"
    if any(w in q for w in INTENTS["why_down"]) or "why" in q:
        return "why_down"
    if any(w in q for w in INTENTS["prep"]):
        return "prep"
    if "yesterday" in q:
        return "yesterday"
    if any(w in q for w in INTENTS["week"]):
        return "week"
    return "general"


async def ask(db, restaurant_id: str, restaurant_name: str, question: str) -> dict:
    intent = detect_intent(question)
    snap = await compute_snapshot(db, restaurant_id)
    facts = format_facts(snap)

    intents_prompt = {
        "yesterday": "The user asks about yesterday. Use F-facts (daily series, last entry) to answer concretely.",
        "week": "The user asks about this week or month. Use the weekly totals and daily series.",
        "best_seller": "The user asks the best-selling item. Rank from the R-facts and D-facts deltas.",
        "worst_seller": "The user asks about weak items. Use D-facts (decliners).",
        "peak": "The user asks their busiest time. Use P-facts.",
        "together": "The user asks which items sell together. Use C-facts (combo pairs).",
        "why_down": "The user asks why sales dropped. Compare the daily series and item decliners; give the most data-backed explanation. If sales are actually UP, say so honestly.",
        "prep": "The user asks what to prepare tomorrow. Base it on risers, peak hours and stock watch facts.",
        "stock": "The user asks about stock. Use I-facts (days left, low stock).",
        "waste": "The user asks about waste. DineDesk does NOT track waste — clearly say you don't have waste data and cannot answer reliably.",
        "general": "Answer the user's question from the fact sheet as directly as possible.",
    }

    err = []
    ai_text = await gemini_explain(
        facts,
        f"Restaurant: {restaurant_name}. User question: \"{question}\"\n"
        f"{intents_prompt[intent]}\n"
        "Answer conversationally in 2-5 sentences, like a trusted assistant. "
        "Quote exact numbers from the sheet where relevant. "
        "If the sheet truly lacks the data, say: you don't have enough data to answer reliably.",
        max_words=140,
        _err_box=err,
    )

    if ai_text:
        return {"answer": ai_text, "ai_generated": True, "intent": intent}

    # No AI → honest computed answer, never a guess
    out = {"answer": _fallback_answer(snap, intent), "ai_generated": False, "intent": intent}
    if err:
        out["ai_error"] = err[0][:200]
    return out


def _fallback_answer(snap: dict, intent: str) -> str:
    s = snap["sales"]
    series = s["daily_series"]
    if intent == "yesterday" and len(series) >= 2:
        y = series[-2]
        return f"Yesterday ({y['date']}) you made Rs.{y['sales']:,.2f} from {y['orders']} orders."
    if intent == "week":
        chg = f", {s['change_pct']}% vs the week before" if s["change_pct"] is not None else ""
        return f"Last 7 days: Rs.{s['last7']:,.2f} from {s['orders_last7']} orders{chg}."
    if intent == "best_seller" and snap["item_movers"]["risers"]:
        m = max(snap["item_movers"]["risers"] + snap["item_movers"]["decliners"], key=lambda x: x["sold_last7"])
        return f"{m['name']} leads with {m['sold_last7']} sold in the last 7 days (Rs.{m['revenue_last7']:,.2f})."
    if intent == "peak" and snap["peak_hours"]:
        p = snap["peak_hours"][0]
        return f"Your busiest hour is {p['hour']}:00 — {p['orders']} orders weekly on average."
    if intent == "together" and snap["combos"]:
        c = snap["combos"][0]
        return f"{c['items'][0]} + {c['items'][1]} appear together in {c['orders']} orders — a natural combo test."
    if intent == "stock" and snap["inventory"]["watch"]:
        it = snap["inventory"]["watch"][0]
        dl = f"about {it['days_left']} days left" if it["days_left"] is not None else "needs attention"
        return f"{it['name']} is closest to running out — {dl}."
    if intent == "waste":
        return "DineDesk doesn't track waste yet, so I can't answer that reliably. Start logging waste and I'll analyse it."
    if intent == "why_down":
        if s["change_pct"] is not None and s["change_pct"] < 0:
            return f"Sales are {abs(s['change_pct'])}% below last week (Rs.{s['prev7']:,.2f} → Rs.{s['last7']:,.2f}). Busiest recent day: " + max(series, key=lambda d: d["sales"])["date"] + "."
        return "Sales are actually holding up — I don't see a drop in the data worth worrying about."
    return "I don't have enough data yet to answer that reliably. Once a few more orders come in, I can dig deeper."


# ────────────────────────────────────────────────────────────────────
# FEATURE 3 — Day-close AI summary (used by the PDF)
# ────────────────────────────────────────────────────────────────────

async def day_close_summary(db, restaurant_id: str, restaurant_name: str, session: dict, day_stats: dict) -> str:
    """Short paragraph for the PDF. Falls back to computed template text."""
    facts = format_facts(day_stats)
    ai_text = await gemini_explain(
        facts,
        f"Restaurant: {restaurant_name}. This is the END-OF-DAY report for {session.get('date', 'today')}. "
        "Write a 3-4 sentence daily insight: how today went vs the recent trend, the strongest performer, "
        "when demand peaked, and ONE advisory prep note for tomorrow. Plain text, no markdown headers.",
        max_words=110,
    )
    if ai_text:
        return ai_text

    s = day_stats["sales"]
    top = (day_stats["item_movers"]["risers"] or [{}])[0]
    peak = (day_stats["peak_hours"] or [{}])[0]
    parts = [f"Today: Rs.{s['last7']:,.2f} from {s['orders_last7']} orders (AOV Rs.{s['aov']:,.2f})."]
    if top:
        parts.append(f"Strongest performer: {top.get('name')} ({top.get('sold_last7')} sold).")
    if peak:
        parts.append(f"Peak demand around {peak.get('hour')}:00.")
    parts.append("Review stock levels before tomorrow's service.")
    return " ".join(parts)


# ────────────────────────────────────────────────────────────────────
# cache helpers
# ────────────────────────────────────────────────────────────────────

# ────────────────────────────────────────────────────────────────────
# Day-close performance brief (4 structured blocks for the PDF)
# ────────────────────────────────────────────────────────────────────

async def day_close_brief_blocks(db, restaurant_id: str, restaurant_name: str, session: dict, day_stats: dict) -> dict:
    """Four blocks for the Daily Performance Brief PDF. Gemini phrases from
    the verified fact sheet; falls back to purely computed text."""
    ai_text = await gemini_explain(
        format_facts(day_stats),
        f"Restaurant: {restaurant_name}. This is the END-OF-DAY brief for {session.get('date', 'today')}. "
        "Write exactly 4 blocks, each on its own line with this prefix:\n"
        "WENT_WELL: 1-2 sentences on what went well today, using exact numbers from the sheet.\n"
        "NEEDS_ATTENTION: 1-2 sentences on the one thing worth watching (peak-hour load, a declining "
        "item, payment mix). If nothing is concerning, say service ran smoothly and why.\n"
        "OPPORTUNITY: 1-2 sentences - strongest items or a natural pairing worth trying as a combo.\n"
        "NEXT_CHECK: one sentence - the single thing to verify before or during tomorrow's service.\n"
        "Facts only from the sheet. Never invent numbers. Max 45 words per block. Plain text.",
        max_words=200,
    )
    blocks = {"went_well": "", "needs_attention": "", "opportunity": "", "next_check": ""}
    if ai_text:
        for raw in ai_text.splitlines():
            line = raw.strip()
            upper = line.upper()
            if upper.startswith("WENT_WELL:"):
                blocks["went_well"] = line[10:].strip()
            elif upper.startswith("NEEDS_ATTENTION:"):
                blocks["needs_attention"] = line[16:].strip()
            elif upper.startswith("OPPORTUNITY:"):
                blocks["opportunity"] = line[12:].strip()
            elif upper.startswith("NEXT_CHECK:"):
                blocks["next_check"] = line[11:].strip()
        if blocks["went_well"]:
            return blocks

    # ── computed fallback (no Gemini, no invented content) ──
    s = day_stats.get("sales", {})
    movers = day_stats.get("item_movers", {})
    peak = (day_stats.get("peak_hours") or [{}])[0]
    pay = s.get("payment_methods", {})
    top_pay = max(pay.items(), key=lambda kv: kv[1]) if pay else None

    blocks["went_well"] = (
        f"Closed at Rs.{s.get('last7', 0):,.2f} from {s.get('orders_last7', 0)} orders "
        f"(average Rs.{s.get('aov', 0):,.2f})."
    )
    riser = (movers.get("risers") or [{}])[0]
    if riser.get("name"):
        blocks["went_well"] += f" {riser['name']} was the strongest performer ({riser.get('sold_last7', 0)} sold)."
    if peak.get("hour") is not None:
        blocks["needs_attention"] = f"Demand peaked around {peak['hour']}:00 - review prep and staffing before tomorrow's peak."
    else:
        blocks["needs_attention"] = "Service ran smoothly with no unusual load patterns today."
    combo = (day_stats.get("combos") or [{}])[0]
    if combo.get("pair"):
        blocks["opportunity"] = f"{combo['pair']} frequently ordered together - worth testing as a simple combo."
    elif riser.get("name"):
        blocks["opportunity"] = f"{riser['name']} is trending - keep it prominent on the menu tomorrow."
    else:
        blocks["opportunity"] = "Build a few days of item-level history to unlock pairing suggestions."
    if top_pay:
        blocks["next_check"] = f"{top_pay[0].upper()} led today's payments - reconcile it against your settlement records."
    else:
        blocks["next_check"] = "Verify cash, UPI and card totals against your settlement records."
    return blocks


def _cache_get(key):
    hit = _CACHE.get(key)
    if hit and (datetime.now(timezone.utc) - hit["t"]).total_seconds() < CACHE_TTL_SECONDS:
        return hit["v"]
    _CACHE.pop(key, None)
    return None


def _cache_set(key, value):
    _CACHE[key] = {"v": value, "t": datetime.now(timezone.utc)}
    if len(_CACHE) > 200:
        _CACHE.clear()


def _public_summary(snap: dict) -> dict:
    """Small verified summary sent to the frontend alongside AI text."""
    return {
        "sales_last7": snap["sales"]["last7"],
        "sales_prev7": snap["sales"]["prev7"],
        "change_pct": snap["sales"]["change_pct"],
        "orders_last7": snap["sales"]["orders_last7"],
        "has_data": snap["sales"]["orders_last7"] > 0,
    }
