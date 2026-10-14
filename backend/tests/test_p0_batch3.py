"""P0 Batch 3 (Phase-1 stabilization): inventory crash recovery.

Covers the window where create_order deducts inventory BEFORE the order
insert and the process dies in between. The recovery engine recomputes the
outstanding quantity from the stock LEDGER — recovery rows carry the same
ref_id, so re-running recovery can never double-restock.
"""
import os
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault("ENABLE_DEMO_ACCOUNT", "false")
os.environ.setdefault("ENABLE_LANDING", "false")

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta, timezone

import pytest
from pymongo.errors import DuplicateKeyError

import server
from server import deduct_inventory, InsufficientStockError
from test_p0_batch2 import B2StubDB, OrdersStubCol, B2StubCol


# ──────────── stubs: generic find + claims collection ────────────

class RcvyStubCol(B2StubCol):
    """find() that actually filters on the query (in / lte / equality)."""

    def find(self, q, proj=None):
        rows = [dict(d) for d in self.docs.values()
                if all(self._match(d, k, v) for k, v in q.items())]

        class Q:
            def sort(self, *a, **k):
                return self
            async def to_list(self, n=None):
                return rows if n is None else rows[:n]
        return Q()


class ClaimsStubCol(RcvyStubCol):
    """_id-keyed claim collection with real duplicate-key behavior."""

    async def insert_one(self, doc):
        key = doc.get("_id")
        if key in self.docs:
            raise DuplicateKeyError(f"E11000 duplicate key: {key}")
        self.docs[key] = dict(doc)
        self.inserted.append(dict(doc))
        return type("R", (), {"inserted_id": key})()

    async def delete_one(self, q):
        key = q.get("_id")
        n = 1 if key in self.docs else 0
        self.docs.pop(key, None)
        return type("R", (), {"deleted_count": n})()


class RecoveryStubDB(B2StubDB):
    def __init__(self):
        super().__init__()
        self.stock_movements = RcvyStubCol([], "stock_movements")
        self.orders = OrdersStubCol()
        self.inventory = B2StubCol([], "inventory")
        self.restaurants = B2StubCol([], "restaurants")
        self.stock_recovery_claims = ClaimsStubCol([], "stock_recovery_claims")


@pytest.fixture()
def rcvy_db(monkeypatch):
    db = RecoveryStubDB()
    monkeypatch.setattr(server, "db", db)
    return db


HOUR_AGO = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

BASE_INV = {"id": "ing1", "restaurant_id": "r1", "name": "Rice",
            "unit": "kg", "quantity": 7.0, "min_quantity": 1.0, "cost_per_unit": 40}


def _sale_row(ref, iid="ing1", delta=-3.0, created_at=HOUR_AGO, rid="r1",
              ref_type="order_deduction"):
    return {
        "id": f"mv_{ref}_{iid}_{delta}", "restaurant_id": rid,
        "inventory_item_id": iid, "item_name": "Rice", "unit": "kg",
        "delta": delta, "movement_type": "sale_usage" if delta < 0 else "adjustment",
        "ref_type": ref_type, "ref_id": ref, "created_at": created_at,
    }


def _recovery_rows(db):
    return [r for r in db.stock_movements.inserted
            if r.get("ref_type") == "order_deduction_recovery"]


def _qty(db, iid="ing1"):
    return db.inventory.docs[iid]["quantity"]


# ──────────── tagging: ledger rows identify the would-be order ────────────

class TestLedgerTagging:
    def test_deduction_rows_carry_order_ref(self, rcvy_db, monkeypatch):
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.menu_items.docs["m1"] = {
            "id": "m1", "restaurant_id": "r1", "name": "Fried Rice",
            "recipe": [{"inventory_item_id": "ing1", "quantity_needed": 2.0}],
        }
        applied = server.asyncio.run(deduct_inventory(
            "r1", [{"menu_item_id": "m1", "quantity": 3}], ref_order_id="oX"))
        sale = [r for r in db.stock_movements.inserted if r["movement_type"] == "sale_usage"]
        assert sale and sale[0]["ref_type"] == "order_deduction" and sale[0]["ref_id"] == "oX"
        assert applied == [("ing1", -6.0)]

    def test_rollback_rows_carry_order_ref(self, rcvy_db):
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        server.asyncio.run(server._compensate_inventory(
            "r1", [("ing1", -3.0)], "rolled back", ref_order_id="oX"))
        assert db.stock_movements.inserted[0]["ref_type"] == "order_deduction_rollback"
        assert db.stock_movements.inserted[0]["ref_id"] == "oX"


class TestCreateOrderWiring:
    def test_create_order_deductions_reference_the_order(self, rcvy_db, monkeypatch):
        """End-to-end: a POS create_order's ledger rows must carry the real
        order id, so recovery can distinguish landed orders from crash orphans."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.menu_items.docs["m1"] = {
            "id": "m1", "restaurant_id": "r1", "name": "Fried Rice", "price": 40.0,
            "is_available": True,
            "recipe": [{"inventory_item_id": "ing1", "inventory_item_name": "Rice",
                        "quantity_needed": 2.0, "unit": "kg"}]}
        db.restaurants.docs["r1"] = {"id": "r1", "tax_rate": 5.0}
        db.day_sessions.docs["s1"] = {"id": "s1", "restaurant_id": "r1", "status": "open"}
        db.orders = OrdersStubCol()
        db.notification_settings = B2StubCol([], "notification_settings")
        from server import OrderCreate, OrderItemCreate, create_order
        data = OrderCreate(order_type="takeaway",
                           items=[OrderItemCreate(menu_item_id="m1", quantity=2)],
                           payment_method="pending")
        resp = server.asyncio.run(create_order(data, user={"id": "u1", "role": "owner",
                                                          "restaurant_id": "r1"}))
        sale = [r for r in db.stock_movements.inserted if r["movement_type"] == "sale_usage"]
        assert sale and sale[0]["ref_type"] == "order_deduction"
        assert sale[0]["ref_id"] == resp.id, "ledger must reference the landed order id"


# ──────────── stock shortage policy (stock_validation on vs off) ────────────

class TestStockShortagePolicy:
    """Task 2: the shortage policy must be explicit and unchanged.

    • stock_validation ABSENT or False → LEGACY behavior: deduction floors at
      zero, sale still succeeds, ledger records the ACTUAL applied delta.
    • stock_validation True → sale is REJECTED with 409 when any ingredient
      is short; on partial failure earlier deductions are compensated.
    """

    def _setup(self, db, stock, enforce):
        db.inventory = B2StubCol([{
            "id": "ing1", "restaurant_id": "r1", "name": "Rice", "unit": "kg",
            "quantity": stock, "min_quantity": 1.0, "cost_per_unit": 40}], "inventory")
        db.menu_items = B2StubCol([{
            "id": "m1", "restaurant_id": "r1", "name": "Fried Rice", "price": 40.0,
            "is_available": True,
            "recipe": [{"inventory_item_id": "ing1", "inventory_item_name": "Rice",
                        "quantity_needed": 2.0, "unit": "kg"}]}], "menu_items")
        db.restaurants = B2StubCol([
            {"id": "r1", "tax_rate": 5.0,
             **({} if enforce is None else {"stock_validation": enforce})}], "restaurants")

    def test_missing_flag_defaults_to_disabled(self, rcvy_db):
        """A restaurant WITHOUT the field keeps exact legacy behavior: the
        sale goes through and the ledger records what was actually applied."""
        db = rcvy_db
        self._setup(db, stock=1.0, enforce=None)  # need 2, have 1
        applied = server.asyncio.run(deduct_inventory(
            "r1", [{"menu_item_id": "m1", "quantity": 1}]))
        assert applied == [("ing1", -1.0)], "floored at zero — actual applied recorded"
        assert db.inventory.docs["ing1"]["quantity"] == 0.0
        assert db.stock_movements.inserted[0]["delta"] == -1.0

    def test_enforce_allows_sufficient_stock_fully(self, rcvy_db):
        """With validation on and stock sufficient, the full amount deducts."""
        db = rcvy_db
        self._setup(db, stock=10.0, enforce=True)
        applied = server.asyncio.run(deduct_inventory(
            "r1", [{"menu_item_id": "m1", "quantity": 2}]))
        assert applied == [("ing1", -4.0)]
        assert db.inventory.docs["ing1"]["quantity"] == 6.0

    def test_enforce_rejects_shortage_and_leaves_stock(self, rcvy_db):
        db = rcvy_db
        self._setup(db, stock=1.0, enforce=True)
        with pytest.raises(InsufficientStockError):
            server.asyncio.run(deduct_inventory(
                "r1", [{"menu_item_id": "m1", "quantity": 1}]))
        assert db.inventory.docs["ing1"]["quantity"] == 1.0, "stock untouched on 409"


# ──────────── startup crash recovery ────────────

class TestCrashRecovery:
    def test_crashed_before_insert_fully_restored(self, rcvy_db):
        """Deduction landed in the ledger, order never inserted → stock back."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs["mv1"] = _sale_row("oc1")
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 10.0, "stock restored exactly once"
        rec = _recovery_rows(db)
        assert len(rec) == 1
        assert rec[0]["delta"] == 3.0 and rec[0]["ref_id"] == "oc1"
        assert rec[0]["balance_after"] == 10.0
        assert db.stock_recovery_claims.docs["r1:oc1"]["status"] == "done"

    def test_recovery_is_idempotent(self, rcvy_db):
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs["mv1"] = _sale_row("oc1")
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        after_first = (len(db.stock_movements.inserted), _qty(db))
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert (len(db.stock_movements.inserted), _qty(db)) == after_first, \
            "second pass must not re-add or write duplicate rows"
        assert len(db.stock_recovery_claims.inserted) == 1

    def test_resumes_remainder_after_mid_recovery_crash(self, rcvy_db):
        """Crash mid-recovery: item A already restocked+rowed, item B still
        outstanding → second run restores ONLY the remainder."""
        db = rcvy_db
        db.inventory.docs = {
            "ing1": {**BASE_INV, "quantity": 10.0},
            "ing2": {"id": "ing2", "restaurant_id": "r1", "name": "Oil",
                     "unit": "l", "quantity": 4.0, "min_quantity": 1.0},
        }
        db.stock_movements.docs = {
            "sA": _sale_row("oc1", iid="ing1", delta=-2.0),
            "rA": _sale_row("oc1", iid="ing1", delta=2.0, ref_type="order_deduction_recovery"),
            "sB": _sale_row("oc1", iid="ing2", delta=-3.0),
        }
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db, "ing1") == 10.0, "already-recovered item untouched"
        assert _qty(db, "ing2") == 7.0, "remainder restored"
        assert len(_recovery_rows(db)) == 1, "no duplicate recovery row for ing1"

    def test_stock_validation_409_settlement_not_touched(self, rcvy_db):
        """A settled 409 (sale rows + rollback rows, net 0, no order) must NOT
        be 'recovered' again."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs = {
            "s1": _sale_row("oc1", delta=-3.0),
            "r1": _sale_row("oc1", delta=3.0, ref_type="order_deduction_rollback"),
        }
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 7.0, "settled compensation left alone"
        assert _recovery_rows(db) == []
        assert db.stock_recovery_claims.inserted == [], "no claim without outstanding"

    def test_live_order_deductions_not_touched(self, rcvy_db):
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.orders.docs["oc1"] = {"id": "oc1", "restaurant_id": "r1",
                                 "order_number": "X1", "status": "preparing"}
        db.stock_movements.docs["mv1"] = _sale_row("oc1")
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 7.0 and _recovery_rows(db) == []

    def test_recent_rows_skipped_within_grace(self, rcvy_db):
        """Grace window: another worker's in-flight create must not be
        recovered mid-request."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        recent = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
        db.stock_movements.docs["mv1"] = _sale_row("oc1", created_at=recent)
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=300))
        assert _qty(db) == 7.0 and _recovery_rows(db) == []

    def test_tenant_isolated_recovery(self, rcvy_db):
        """Rows for restaurant r2 only touch r2's inventory."""
        db = rcvy_db
        db.inventory.docs = {
            "ing1": dict(BASE_INV),
            "ing2": {"id": "ing2", "restaurant_id": "r2", "name": "Salt",
                     "unit": "g", "quantity": 5.0, "min_quantity": 0},
        }
        db.stock_movements.docs["mv1"] = _sale_row("oc2", iid="ing2", delta=-2.0, rid="r2")
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db, "ing1") == 7.0, "r1 untouched"
        assert _qty(db, "ing2") == 7.0, "r2 restored"

    def test_positive_net_flagged_not_touched(self, rcvy_db, caplog):
        """Ledger corruption (more restocked than deducted for a deduct-only
        ref) must NOT be 'recovered' — flagged for manual review instead."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs = {
            "s1": _sale_row("oc1", delta=-3.0),
            "x1": _sale_row("oc1", delta=5.0, ref_type="order_deduction_rollback"),
        }
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 7.0 and _recovery_rows(db) == []

    def test_active_claim_blocks_second_worker(self, rcvy_db):
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs["mv1"] = _sale_row("oc1")
        db.stock_recovery_claims.docs["r1:oc1"] = {
            "_id": "r1:oc1", "status": "processing",
            "claimed_at": datetime.now(timezone.utc).isoformat()}
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 7.0 and _recovery_rows(db) == [], \
            "active claim from the other worker must block"

    def test_stale_claim_reclaimed(self, rcvy_db):
        """A 'processing' claim from a dead process is reclaimable."""
        db = rcvy_db
        db.inventory.docs["ing1"] = dict(BASE_INV)
        db.stock_movements.docs["mv1"] = _sale_row("oc1")
        db.stock_recovery_claims.docs["r1:oc1"] = {
            "_id": "r1:oc1", "status": "processing", "claimed_at": HOUR_AGO}
        server.asyncio.run(server.recover_orphaned_order_deductions(grace_seconds=0))
        assert _qty(db) == 10.0 and _recovery_rows(db)
