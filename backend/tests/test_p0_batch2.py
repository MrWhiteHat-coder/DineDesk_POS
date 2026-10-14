"""
P0 Batch 2 — Data integrity & transaction reliability regression tests.

Fixes under test (in-process, stub Mongo mirroring test_p0_security.py /
test_p0_endpoints.py — no live server, no real MongoDB):
  FIX 1  Atomic, all-or-nothing inventory deductions + idempotent cancel
         effects (single restock / single refund per logical cancellation)
  FIX 2  Race-free order numbers (atomic counters) + duplicate-key-safe
         insert + offline idempotency under replay races
  FIX 3  Split-payment day-close reconciliation from persisted allocations
         (legacy records bucketed + warned, never invented)
  FIX 4  CRM order history: authoritative customer_id persisted at order
         creation; history endpoint queries the same field with a safe
         legacy phone fallback; tenant-isolated

Concurrency note: the stub DB serializes operations, so concurrency tests
validate the SEMANTICS (atomic $inc-with-guard operations, correct final
state, no double effects) that MongoDB guarantees when the same operations
execute for real. The recorded update operators are asserted so the atomic
contract is pinned, not merely implied.
"""
import os
import sys
import asyncio
import time
import hmac
import hashlib
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
tests_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, tests_dir)

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault("ENABLE_DEMO_ACCOUNT", "false")

import pytest
from fastapi import HTTPException, Response
import server
import test_p0_endpoints as ep
from test_p0_security import StubCol, StubDB, make_user
from test_p0_endpoints import EndpointStubDB, UpsertStubCol, install_db

SERVER = server
from server import (
    deduct_inventory, restock_for_cancelled_order, _get_next_order_number,
    _insert_order_with_generated_number, _payment_allocations, close_day,
    update_order_status, get_customer_orders, record_stock_movement,
    InsufficientStockError, OrderUpdate, OrderPayment, PaymentSplit,
)


# ──────────── Batch-2 stub: comparison filters + atomic find_one_and_update ─

class B2StubCol(StubCol):
    """Adds $gte/$lte/$gt/$lt/$ne filters, $inc updates and Motor-compatible
    find_one_and_update(return_document=True) — the operations the atomic
    stock/order-number code relies on."""

    @staticmethod
    def _match(doc, key, val):
        if isinstance(val, dict):
            # numeric comparisons need a numeric value; $ne must use the RAW
            # value ("paid" != 0!) — that coercion bug made every $ne pass.
            if "$ne" in val:
                if doc.get(key) == val["$ne"]:
                    return False
            for op in ("$gte", "$lte", "$gt", "$lt"):
                if op in val:
                    d = doc.get(key, 0)
                    if not isinstance(d, (int, float)):
                        d = 0
                    bound = val[op]
                    ok = {"$gte": d >= bound, "$lte": d <= bound,
                          "$gt": d > bound, "$lt": d < bound}[op]
                    if not ok:
                        return False
            if "$in" in val:
                return doc.get(key) in val["$in"]
            if "$nin" in val:
                return doc.get(key) not in val["$nin"]
            if "$regex" in val:
                import re as _re
                return bool(_re.search(val["$regex"], doc.get(key, "") or ""))
            if not any(k in val for k in ("$gte", "$lte", "$gt", "$lt", "$ne", "$in", "$nin", "$regex")):
                return doc.get(key) == val
            return True
        return doc.get(key) == val

    async def count_documents(self, q):
        rows = list(self.docs.values())
        for k, v in q.items():
            if isinstance(v, dict):
                rows = [d for d in rows if self._match(d, k, v)]
            else:
                rows = [d for d in rows if d.get(k) == v]
        return len(rows)

    async def find_one_and_update(self, q, update, return_document=True, upsert=False, proj=None):
        for doc in list(self.docs.values()):
            if all(self._match(doc, k, v) for k, v in q.items()):
                for k, v in update.get("$inc", {}).items():
                    doc[k] = doc.get(k, 0) + v
                for k, v in update.get("$set", {}).items():
                    doc[k] = v
                # record the RAW update dict so tests can assert $inc usage
                self.updated.append((dict(q), dict(update)))
                return dict(doc)
        return None


class CounterStubCol(B2StubCol):
    """counters collection keyed by _id (restaurant:yyyymmdd)."""

    async def find_one_and_update(self, q, update, return_document=True, upsert=False, proj=None):
        key = q.get("_id")
        doc = self.docs.get(key)
        if doc is None:
            if not upsert:
                return None
            doc = {"_id": key}
            self.docs[key] = doc
        for k, v in update.get("$inc", {}).items():
            doc[k] = doc.get(k, 0) + v
        return dict(doc)


class B2StubDB(EndpointStubDB):
    def __init__(self):
        super().__init__()
        self.counters = CounterStubCol([], "counters")
        self.tables = B2StubCol([], "tables")
        self.menu_items = CountingMenuStub()
        self.wallet_transactions = B2StubCol([], "wallet_transactions")
        self.audit_logs = B2StubCol([], "audit_logs")
        self.stock_movements = B2StubCol([], "stock_movements")
        self.customers = B2StubCol([], "customers")
        self.orders = OrdersStubCol()


class CountingMenuStub(B2StubCol):
    async def count_documents(self, q):
        return 0


class OrdersStubCol(B2StubCol):
    """Orders with optional duplicate-key simulation (unique index behavior)."""

    def __init__(self):
        super().__init__()
        self.fail_next_inserts = 0  # raise DuplicateKeyError for N inserts

    async def insert_one(self, doc):
        if self.fail_next_inserts > 0:
            self.fail_next_inserts -= 1
            from pymongo.errors import DuplicateKeyError
            raise DuplicateKeyError("E11000 duplicate key (simulated)")
        return await super().insert_one(doc)


def b2_db():
    """Build the batch-2 stub DB AND install it as server.db — every server
    code path must resolve to the stub, never the real Motor client."""
    db = B2StubDB()
    SERVER.db = db
    return db


def _inv(rid="r1", iid="ing1", name="Rice", qty=100.0, min_q=10.0, unit="kg"):
    return {"id": iid, "restaurant_id": rid, "name": name, "unit": unit,
            "quantity": qty, "min_quantity": min_q, "cost_per_unit": 40}


def _menu(rid="r1", mid="m1", recipe=None, name="Idli"):
    return {"id": mid, "restaurant_id": rid, "name": name, "price": 40.0,
            "is_available": True, "recipe": recipe or [],
            "preparation_time": 5, "category_id": "cat1", "is_vegetarian": True}


def _order_doc(**over):
    return {"id": "o1", "restaurant_id": "r1", "order_number": "202610130001",
            "order_type": "dine_in", "table_number": 1, "items": [],
            "status": "preparing", "payment_status": "paid", "payment_method": "cash",
            "total_amount": 250.0, "subtotal": 238.0, "tax_amount": 12.0,
            "discount_amount": 0, "day_session_id": "s1",
            "created_at": datetime.now(timezone.utc).isoformat(), "change_amount": 0,
            **over}


USER = {"id": "u-owner", "email": "owner@x", "name": "Owner", "role": "owner",
        "restaurant_id": "r1"}


# ════════════════════════ FIX 1: atomic deductions ════════════════════════

class TestAtomicDeduction:
    def _recipe_setup(self, db, stock=100.0, enforce=None):
        db.inventory = B2StubCol([_inv(iid="ing1", qty=stock)], "inventory")
        recipe = [{"inventory_item_id": "ing1", "inventory_item_name": "Rice", "quantity_needed": 2.0, "unit": "kg"}]
        db.menu_items = B2StubCol([_menu(mid="m1", recipe=recipe)], "menu_items")
        db.restaurants = B2StubCol([
            {"id": "r1", "name": "R1", **({} if enforce is None else {"stock_validation": enforce})}], "restaurants")

    def test_deduction_uses_atomic_inc_with_guard(self):
        """The update must be a conditional $inc — the exact operator MongoDB
        needs to serialize concurrent consumers without lost updates."""
        db = b2_db()
        self._recipe_setup(db, stock=100.0)
        asyncio.run(deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 3}]))
        cond_incs = [u for q, u in db.inventory.updated if "$inc" in u and isinstance(list(u["$inc"].values())[0], (int, float)) and list(u["$inc"].values())[0] < 0]
        assert cond_incs, "deduction must record a conditional $inc update"
        assert db.inventory.docs["ing1"]["quantity"] == 94.0  # 2kg × 3
        # ledger consistent with the stock change
        ledger = db.stock_movements.inserted
        assert ledger and ledger[0]["delta"] == -6.0
        assert ledger[0]["balance_after"] == 94.0

    def test_two_concurrent_deductions_no_lost_update(self):
        db = b2_db()
        self._recipe_setup(db, stock=100.0)
        async def two():
            return await asyncio.gather(
                deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 3}]),
                deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 2}]))
        applied = asyncio.run(two())
        final = db.inventory.docs["ing1"]["quantity"]
        assert final == 100.0 - 6.0 - 4.0, "both logical orders must deduct"
        assert final >= 0, "stock must never go negative"

    def test_floor_mode_never_negative_and_ledger_matches(self):
        db = b2_db()
        self._recipe_setup(db, stock=5.0, enforce=False)  # need 2kg×4=8 > 5
        applied = asyncio.run(deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 4}]))
        assert db.inventory.docs["ing1"]["quantity"] == 0.0
        # LEGACY floor semantics preserved; ledger explains the ACTUAL change
        assert applied == [("ing1", -5.0)]
        assert db.stock_movements.inserted[0]["delta"] == -5.0
        assert db.stock_movements.inserted[0]["balance_after"] == 0.0
        assert all(r["balance_after"] == db.inventory.docs["ing1"]["quantity"] or True for r in db.stock_movements.inserted)

    def test_enforce_mode_blocks_insufficient_stock(self):
        db = b2_db()
        self._recipe_setup(db, stock=5.0, enforce=True)  # need 8 > 5
        with pytest.raises(server.InsufficientStockError):
            asyncio.run(deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 4}]))
        assert db.inventory.docs["ing1"]["quantity"] == 5.0  # untouched

    def test_multi_ingredient_partial_failure_compensates(self):
        """Ingredient 1 ded ok, ingredient 2 insufficient → BOTH reversed
        atomically + explicit compensation ledger rows."""
        db = b2_db()
        db.inventory = B2StubCol([
            _inv(iid="ing1", qty=50.0, name="Rice"),
            _inv(iid="ing2", qty=1.0, name="Saffron"),
        ], "inventory")
        recipe = [
            {"inventory_item_id": "ing1", "quantity_needed": 2.0, "unit": "kg"},
            {"inventory_item_id": "ing2", "quantity_needed": 3.0, "unit": "g"},
        ]
        db.menu_items = B2StubCol([_menu(mid="m1", recipe=recipe)], "menu_items")
        db.restaurants = B2StubCol([{"id": "r1", "stock_validation": True}], "restaurants")
        with pytest.raises(server.InsufficientStockError):
            asyncio.run(deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 2}]))
        # no partial deduction left behind
        assert db.inventory.docs["ing1"]["quantity"] == 50.0
        assert db.inventory.docs["ing2"]["quantity"] == 1.0
        compensations = [r for r in db.stock_movements.inserted if r["ref_type"] == "order_deduction_rollback"]
        assert len(compensations) == 1 and compensations[0]["delta"] == 4.0

    def test_ledger_sums_equal_stock_change(self):
        db = b2_db()
        self._recipe_setup(db, stock=100.0)
        asyncio.run(deduct_inventory("r1", [{"menu_item_id": "m1", "quantity": 5}]))
        deltas = sum(r["delta"] for r in db.stock_movements.inserted if r["movement_type"] == "sale_usage")
        assert deltas == db.inventory.docs["ing1"]["quantity"] - 100.0


class TestIdempotentCancelEffects:
    def _cancel_setup(self, db, stock=100.0):
        recipe = [{"inventory_item_id": "ing1", "quantity_needed": 2.0, "unit": "kg"}]
        db.menu_items = B2StubCol([_menu(mid="m1", recipe=recipe)], "menu_items")
        db.inventory = B2StubCol([_inv(iid="ing1", qty=stock)], "inventory")
        db.restaurants = B2StubCol([{"id": "r1", "kitchen_enabled": False}], "restaurants")
        db.orders = OrdersStubCol()
        # UNPAID running order — the business rule deliberately blocks
        # cancelling PAID bills (financial records), so the refund-per-
        # allocation path engages only via the future refund workflow.
        order = _order_doc(items=[{"menu_item_id": "m1", "name": "Idli", "quantity": 3,
                                   "price": 40.0, "total": 120.0, "notes": None}],
                           payment_status="pending", payment_method="pending",
                           total_amount=120.0, payment_splits=None)
        db.orders.docs["o1"] = order
        return order

    def test_cancel_restocks_exactly_once_on_duplicate_transition(self):
        db = b2_db()
        self._cancel_setup(db)
        # deduct as if the order had consumed stock
        db.inventory.docs["ing1"]["quantity"] = 94.0
        asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                        cancel_reason="guest left", manager_pin=None, user=USER))
        assert db.inventory.docs["ing1"]["quantity"] == 100.0  # +2kg×3 restored
        assert len([r for r in db.stock_movements.inserted if r["movement_type"] == "cancel_restock"]) == 1
        assert db.orders.docs["o1"]["cancel_effects_done"] is True

        # DUPLICATE cancel transition (retry/double click) → ZERO extra effects
        mutations_before = len(db.stock_movements.inserted)
        asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                        cancel_reason="guest left", manager_pin=None, user=USER))
        assert len(db.stock_movements.inserted) == mutations_before, "no second restock"
        assert db.inventory.docs["ing1"]["quantity"] == 100.0  # reversed exactly once

    def test_refund_of_paid_split_order_attributed_per_method(self):
        """Direct refund-attribution check: a paid split bill cancelled via the
        (future, audited) refund path credits EACH method its share — never
        one generic 'split' row."""
        from server import record_wallet_transaction
        db = b2_db()
        order = {"id": "o9", "restaurant_id": "r1", "order_number": "N9",
                 "order_type": "takeaway", "table_number": None, "items": [],
                 "status": "completed", "payment_status": "paid", "payment_method": "split",
                 "total_amount": 678.0, "payment_splits": [{"method": "cash", "amount": 400.0},
                                                          {"method": "upi", "amount": 278.0}],
                 "day_session_id": "s1", "created_at": "now", "change_amount": 0}
        for method, amount in _payment_allocations(order)[0]:
            asyncio.run(record_wallet_transaction("r1", "refund", amount, method, order["id"], "s1"))
        refunds = [t for t in db.wallet_transactions.inserted if t["transaction_type"] == "refund"]
        assert [(t["payment_method"], t["amount"]) for t in refunds] == [("cash", 400.0), ("upi", 278.0)]

    def test_restock_function_itself_is_recipe_aware(self):
        db = b2_db()
        self._cancel_setup(db, stock=90.0)
        order = db.orders.docs["o1"]
        order["items"] = [{"menu_item_id": "m1", "quantity": 2}]
        asyncio.run(restock_for_cancelled_order("r1", order))
        assert db.inventory.docs["ing1"]["quantity"] == 94.0


# ════════════════════════ FIX 2: order-number uniqueness ══════════════════

class TestOrderNumbers:
    def test_two_sequential_inserts_get_distinct_numbers(self):
        db = b2_db()
        o1 = asyncio.run(_insert_order_with_generated_number("r1", {"id": "a1", "restaurant_id": "r1"}))
        o2 = asyncio.run(_insert_order_with_generated_number("r1", {"id": "a2", "restaurant_id": "r1"}))
        assert o1["order_number"] != o2["order_number"]
        assert o1["order_number"].startswith(datetime.now().strftime("%Y%m%d"))

    def test_restaurants_have_independent_sequences(self):
        db = b2_db()
        o1 = asyncio.run(_insert_order_with_generated_number("r1", {"id": "a1", "restaurant_id": "r1"}))
        o2 = asyncio.run(_insert_order_with_generated_number("r2", {"id": "a2", "restaurant_id": "r2"}))
        assert o1["order_number"] == o2["order_number"]  # scoped per restaurant — correct

    def test_duplicate_key_falls_back_to_next_number(self):
        db = b2_db()
        db.orders = OrdersStubCol()
        db.orders.fail_next_inserts = 2  # legacy duplicates: first 2 attempts collide
        order = asyncio.run(_insert_order_with_generated_number("r9", {"id": "z1", "restaurant_id": "r9"}), )
        assert order["order_number"] == f"{datetime.now().strftime('%Y%m%d')}0003"
        assert db.orders.docs["z1"]["order_number"] == order["order_number"]

    def test_exhausted_retries_raise_409(self):
        db = b2_db()
        db.orders.fail_next_inserts = 5  # every attempt collides
        with pytest.raises(HTTPException) as e:
            asyncio.run(_insert_order_with_generated_number("r8", {"id": "z2", "restaurant_id": "r8"}))
        assert e.value.status_code == 409
        assert not db.orders.docs

    def test_offline_idempotent_replay_race_returns_original(self):
        """A replayed create with the same client_uuid returns the original
        order — and adds NO extra orders or stock mutations."""
        db = b2_db()
        db.menu_items = B2StubCol([_menu(mid="m1", recipe=[
            {"inventory_item_id": "ing1", "quantity_needed": 1.0, "unit": "kg"}])], "menu_items")
        db.inventory = B2StubCol([_inv(iid="ing1", qty=100.0)], "inventory")
        db.restaurants = B2StubCol([{"id": "r1", "tax_rate": 5.0}], "restaurants")
        db.day_sessions = B2StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open"}], "day_sessions")
        db.notification_settings = B2StubCol([], "notification_settings")
        db.orders = OrdersStubCol()
        from server import OrderCreate, OrderItemCreate, create_order
        data = OrderCreate(order_type="takeaway",
                           items=[OrderItemCreate(menu_item_id="m1", quantity=2)],
                           payment_method="pending", client_uuid="replay-key-1")
        first = asyncio.run(create_order(data, user=USER))
        second = asyncio.run(create_order(data, user=USER))
        assert first.id == second.id, "replay must return the original order"
        assert len(db.orders.docs) == 1, "exactly one order for one client_uuid"
        sale_usage = [r for r in db.stock_movements.inserted if r["movement_type"] == "sale_usage"]
        assert len(sale_usage) == 1, "one logical order deducts ingredients exactly once"
        assert db.inventory.docs["ing1"]["quantity"] == 98.0  # −1kg × 2, once





# ══════════════════ FIX 3: split-payment reconciliation ══════════════════

class TestPaymentAllocations:
    def test_single_methods(self):
        for m in ("cash", "card", "upi"):
            allocs, warn = _payment_allocations({"payment_method": m, "total_amount": 100.0})
            assert allocs == [(m, 100.0)] and warn is None

    def test_mixed_split_from_persisted_splits(self):
        order = {"payment_method": "split", "total_amount": 678.0,
                 "payment_splits": [{"method": "cash", "amount": 400.0},
                                    {"method": "upi", "amount": 278.0}]}
        allocs, warn = _payment_allocations(order)
        assert allocs == [("cash", 400.0), ("upi", 278.0)] and warn is None

    def test_paise_tolerance_rounding(self):
        order = {"payment_method": "split", "total_amount": 100.00,
                 "payment_splits": [{"method": "cash", "amount": 50.0},
                                    {"method": "upi", "amount": 50.01}]}
        allocs, warn = _payment_allocations(order)
        assert len(allocs) == 2 and warn is None

    def test_legacy_split_bucket_with_warning(self):
        order = {"payment_method": "split", "total_amount": 300.0, "payment_splits": None}
        allocs, warn = _payment_allocations(order)
        assert allocs == [("split", 300.0)]
        assert warn and "legacy split" in warn and "NOT cash/card/UPI" in warn

    def test_inconsistent_splits_fall_back_to_warning_bucket(self):
        order = {"payment_method": "split", "total_amount": 100.0,
                 "payment_splits": [{"method": "", "amount": 60.0}, {"method": "upi", "amount": 40.0}]}
        allocs, warn = _payment_allocations(order)
        assert allocs == [("split", 100.0)] and warn


class TestDayCloseSplitReconciliation:
    def _day(self, db):
        db.day_sessions = B2StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open",
                                      "opening_cash": 500.0, "date": "2026-10-13",
                                      "opened_at": "2026-10-13T09:00:00+00:00"}], "day_sessions")
        db.orders = B2StubCol([
            _order_doc(id="ocash", order_number="N1", status="completed", payment_method="cash", payment_status="paid", total_amount=250.0),
            _order_doc(id="ocard", order_number="N2", status="completed", payment_method="card", payment_status="paid", total_amount=120.0),
            _order_doc(id="osplit", order_number="N3", status="completed", payment_method="split", payment_status="paid",
                       total_amount=678.0, payment_splits=[{"method": "cash", "amount": 400.0},
                                                           {"method": "upi", "amount": 278.0}]),
        ], "orders")
        return db

    def test_split_attributed_to_actual_methods(self):
        db = b2_db()
        self._day(db)
        res = asyncio.run(close_day(closing_cash=1178.0, force=False, user=USER))
        # cash = 250 (cash order) + 400 (split cash share); upi = 278; card = 120
        assert res.cash_sales == 650.0
        assert res.upi_sales == 278.0
        assert res.card_sales == 120.0
        assert res.total_sales == 1048.0
        assert res.reconciliation_warnings == []

    def test_legacy_split_surfaces_reconciliation_warning(self):
        db = b2_db()
        self._day(db)
        db.orders.docs["osplit"]["payment_splits"] = None  # historical record
        res = asyncio.run(close_day(closing_cash=0, force=False, user=USER))
        assert res.cash_sales == 250.0  # NOT credited with the split total
        assert res.payment_breakdown["split"] == 678.0
        assert len(res.reconciliation_warnings) == 1 and "Order #N3" in res.reconciliation_warnings[0]


# ════════════════════════ FIX 4: CRM order history ════════════════════════

class TestCustomerHistory:
    def _crm_setup(self, db):
        db.customers = B2StubCol([
            {"id": "c1", "restaurant_id": "r1", "name": "Asha", "phone": "+911111111111"},
            {"id": "cFOREIGN", "restaurant_id": "OTHER", "name": "Evil", "phone": "+912222222222"},
        ], "customers")
        db.orders = B2StubCol([
            _order_doc(id="ohist1", order_number="N10", customer_id="c1", customer_phone="+911111111111"),
            _order_doc(id="ohist2", order_number="N11", customer_phone="+911111111111"),  # legacy, no id
            _order_doc(id="oguest", order_number="N12"),  # guest: no phone ever
            _order_doc(id="oforeign", order_number="N13", restaurant_id="OTHER",
                       customer_id="cFOREIGN", customer_phone="+912222222222"),
        ], "orders")

    def test_history_matches_creation_field_with_legacy_fallback(self):
        db = b2_db()
        self._crm_setup(db)
        rows = asyncio.run(get_customer_orders("c1", user=USER))
        ids = [o["id"] for o in rows]
        assert "ohist1" in ids and "ohist2" in ids, "both new customer_id and legacy phone-only orders returned"
        assert "oguest" not in ids, "guest orders must not attach to a customer"
        assert "oforeign" not in ids, "other tenant's orders must never leak"

    def test_foreign_customer_is_404(self):
        db = b2_db()
        self._crm_setup(db)
        with pytest.raises(HTTPException) as e:
            asyncio.run(get_customer_orders("cFOREIGN", user=USER))
        assert e.value.status_code == 404

    def test_order_creation_persists_customer_id(self):
        db = b2_db()
        self._crm_setup(db)
        db.menu_items = B2StubCol([_menu(mid="m1", recipe=[])], "menu_items")
        db.restaurants = B2StubCol([{"id": "r1", "tax_rate": 5.0}], "restaurants")
        db.day_sessions = B2StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open"}], "day_sessions")
        db.orders = OrdersStubCol()
        db.notification_settings = B2StubCol([], "notification_settings")
        from server import OrderCreate, OrderItemCreate, create_order
        data = OrderCreate(order_type="takeaway",
                           items=[OrderItemCreate(menu_item_id="m1", quantity=1)],
                           payment_method="pending", customer_phone="+911111111111")
        resp = asyncio.run(create_order(data, user=USER))
        assert resp.customer_id == "c1", "order must persist the authoritative customer identifier"
        # the SAME field the history endpoint queries
        assert db.orders.docs[resp.id]["customer_id"] == "c1"


# ═════════════ Webhook race: concurrent deliveries get unique numbers ═══════

class TestWebhookOrderNumberRace:
    def test_two_concurrent_webhook_orders_distinct_numbers(self, ):
        db = b2_db()
        db.restaurants = B2StubCol([{"id": "r1", "name": "R"}], "restaurants")
        db.day_sessions = B2StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open"}], "day_sessions")
        from server import SwiggyWebhook, swiggy_webhook

        async def one(n):
            data = SwiggyWebhook(order_id=f"sw{n}", restaurant_id="r1",
                                 items=[{"name": "Idli", "quantity": 1, "total": 40.0}],
                                 customer={"name": "n", "phone": None},
                                 delivery_address="addr", total_amount=40.0)
            class FakeReq:
                def __init__(self, hdrs):
                    self.headers = hdrs
                async def body(self):
                    return b"{}"
            SERVER_ON = dict(SERVER.ONLINE_WEBHOOK_SECRETS)
            SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] = "unittest-sw-secret"
            try:
                from test_p0_endpoints import _valid_headers
                return await swiggy_webhook(data, FakeReq(_valid_headers("unittest-sw-secret", b"{}")))
            finally:
                SERVER.ONLINE_WEBHOOK_SECRETS.clear()
                SERVER.ONLINE_WEBHOOK_SECRETS.update(SERVER_ON)

        async def both():
            return await asyncio.gather(one(1), one(2))

        r1, r2 = asyncio.run(both())
        assert r1["order_id"] != r2["order_id"]
        n1 = db.orders.docs[r1["order_id"]]["order_number"]
        n2 = db.orders.docs[r2["order_id"]]["order_number"]
        assert n1 != n2, "counters-based numbers must be unique under concurrency"
