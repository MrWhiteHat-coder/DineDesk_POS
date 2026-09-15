"""
DineDesk reliability tests — in-process, no live server or Mongo needed.

Covers the Guard and data-integrity work:
- Audit log write (who/when/what/why) + role-restricted read
- Order cancel requires a reason (no silent cancels)
- Manager PIN enforcement when configured
- Duplicate payment prevention
- Stock movement ledger correctness
- Day-close guard (no open session)
- Tenant-scoped inventory update
"""

import os
import sys
import asyncio
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")

import pytest
from fastapi import HTTPException

import server
from server import (
    require_reason,
    require_manager_pin,
    write_audit,
    record_stock_movement,
    update_order_status,
    pay_order,
    close_day,
    update_inventory_item,
    get_audit_logs,
    OrderUpdate,
    OrderPayment,
    InventoryItemUpdate,
)


# ──────────── stub Mongo ────────────

class StubCol:
    """Minimal async stub for motor collections used in these tests."""

    def __init__(self, docs=None):
        self.docs = {d["id"]: d for d in (docs or [])}
        self.inserted = []
        self.updated = []

    async def find_one(self, q, proj=None):
        doc = self.docs.get(q.get("id"))
        if doc is None:
            return None
        if "restaurant_id" in q and doc.get("restaurant_id") != q["restaurant_id"]:
            return None
        return dict(doc)

    async def update_one(self, q, update):
        doc = self.docs.get(q.get("id"))
        if doc is None:
            return None
        if "restaurant_id" in q and doc.get("restaurant_id") != q["restaurant_id"]:
            return None
        set_data = update.get("$set", {})
        doc.update(set_data)
        self.updated.append((q, set_data))
        return type("R", (), {"modified_count": 1})()

    async def insert_one(self, doc):
        self.inserted.append(dict(doc))
        self.docs[doc["id"]] = dict(doc)
        return type("R", (), {"inserted_id": "stub"})()

    def find(self, q, proj=None):
        rows = [dict(d) for d in self.docs.values()
                if d.get("restaurant_id") == q.get("restaurant_id")]
        created_q = q.get("created_at") or {}
        if isinstance(created_q, dict) and "$gte" in created_q:
            gte = created_q["$gte"]
            rows = [d for d in rows if d.get("created_at", "") >= gte]

        class Q:
            def sort(self, *a, **k):
                rows.sort(key=lambda d: d.get("created_at", ""), reverse=True)
                return self
            async def to_list(self, n=None):
                return rows if n is None else rows[:n]
        return Q()


class StubDB:
    def __init__(self):
        self.orders = StubCol()
        self.audit_logs = StubCol()
        self.stock_movements = StubCol()
        self.system_logs = StubCol()
        self.tables = StubCol()
        self.day_sessions = StubCol()
        self.inventory = StubCol()
        self.wallet_transactions = StubCol()
        self.restaurants = StubCol()
        self.notification_settings = StubCol()

    def command(self, cmd):
        async def _noop(*a, **k):
            return {"ok": 1}
        return _noop()


@pytest.fixture()
def stub_db(monkeypatch):
    db = StubDB()
    monkeypatch.setattr(server, "db", db)
    return db


USER = {"id": "u1", "name": "Demo Owner", "role": "owner", "restaurant_id": "r1"}
OTHER_USER = {"id": "u2", "name": "Other Owner", "role": "owner", "restaurant_id": "r2"}


# ──────────── Guard: reason + PIN ────────────

class TestGuardReason:
    def test_missing_reason_rejected(self):
        with pytest.raises(HTTPException) as e:
            require_reason(None, "cancel an order")
        assert e.value.status_code == 400

    def test_blank_reason_rejected(self):
        with pytest.raises(HTTPException) as e:
            require_reason("   ", "delete an item")
        assert e.value.status_code == 400

    def test_valid_reason_returned_stripped(self):
        assert require_reason("  customer left  ", "cancel") == "customer left"


class TestGuardPin:
    def test_no_pin_configured_passes(self, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        require_manager_pin(None)  # must not raise

    def test_wrong_pin_rejected(self, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "9911")
        with pytest.raises(HTTPException) as e:
            require_manager_pin("0000")
        assert e.value.status_code == 403

    def test_correct_pin_passes(self, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "9911")
        require_manager_pin("9911")  # must not raise


# ──────────── Guard: audit trail ────────────

class TestAuditTrail:
    def test_write_audit_captures_who_when_what(self, stub_db):
        asyncio.run(write_audit(USER, "order.cancel", "order", "o1", "Order #123",
                                "customer left", "Cancelled order #123"))
        assert len(stub_db.audit_logs.inserted) == 1
        doc = stub_db.audit_logs.inserted[0]
        assert doc["user_id"] == "u1"
        assert doc["user_name"] == "Demo Owner"
        assert doc["user_role"] == "owner"
        assert doc["restaurant_id"] == "r1"
        assert doc["action"] == "order.cancel"
        assert doc["reason"] == "customer left"
        # timestamp is ISO and recent
        datetime.fromisoformat(doc["created_at"])

    def test_audit_read_owner_only(self, stub_db):
        asyncio.run(write_audit(USER, "day.close", "day_session", "s1"))
        rows = asyncio.run(get_audit_logs(user=USER))
        assert isinstance(rows, list)
        assert any(r["action"] == "day.close" for r in rows)
        with pytest.raises(HTTPException) as e:
            asyncio.run(get_audit_logs(user={**USER, "role": "cashier"}))
        assert e.value.status_code == 403


# ──────────── Order cancel requires reason ────────────

PAID_ORDER = {
    "id": "o1", "restaurant_id": "r1", "order_number": "1001",
    "status": "preparing", "order_type": "takeaway",
    "payment_status": "paid", "payment_method": "cash",
    "total_amount": 250.0, "subtotal": 238.0, "tax_amount": 12.0,
    "discount_amount": 0, "items": [], "table_number": None,
    "day_session_id": "s1", "created_at": datetime.now(timezone.utc).isoformat(),
    "change_amount": 0,
}

# Unpaid running order — cancellable with a reason (never a paid one)
UNPAID_ORDER = {**PAID_ORDER, "payment_status": "pending", "payment_method": "pending"}


class TestCancelGuard:
    def test_cancel_without_reason_blocked(self, stub_db, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        stub_db.orders.docs["o1"] = PAID_ORDER
        with pytest.raises(HTTPException) as e:
            asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                            cancel_reason=None, manager_pin=None, user=USER))
        assert e.value.status_code == 400
        assert "reason" in str(e.value.detail).lower()

    def test_cancel_with_reason_audited(self, stub_db, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        order = {**UNPAID_ORDER, "table_number": None}
        stub_db.orders.docs["o1"] = order
        stub_db.day_sessions.docs["s1"] = {"id": "s1", "restaurant_id": "r1", "status": "open"}
        asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                        cancel_reason="customer left", manager_pin=None, user=USER))
        actions = [d["action"] for d in stub_db.audit_logs.inserted]
        assert "order.cancel" in actions

    def test_cancel_completed_order_blocked(self, stub_db, monkeypatch):
        """Completed/paid bills are financial records — cancel must be rejected."""
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        stub_db.orders.docs["o1"] = {**PAID_ORDER, "status": "completed"}
        with pytest.raises(HTTPException) as e:
            asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                            cancel_reason="mistake", manager_pin=None, user=USER))
        assert e.value.status_code == 400
        assert "completed or paid" in str(e.value.detail).lower()

    def test_cancel_with_pin_configured_requires_pin(self, stub_db, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "9911")
        stub_db.orders.docs["o1"] = PAID_ORDER
        with pytest.raises(HTTPException) as e:
            asyncio.run(update_order_status("o1", OrderUpdate(status="cancelled"),
                                            cancel_reason="customer left", manager_pin=None, user=USER))
        assert e.value.status_code == 403


# ──────────── Money: duplicate payment ────────────

class TestDuplicatePayment:
    def test_already_paid_order_rejected(self, stub_db):
        stub_db.orders.docs["o1"] = PAID_ORDER
        with pytest.raises(HTTPException) as e:
            asyncio.run(pay_order("o1", OrderPayment(payment_method="cash"), user=USER))
        assert e.value.status_code == 400
        assert "already paid" in str(e.value.detail).lower()


# ──────────── Inventory ledger ────────────

class TestStockLedger:
    def test_movement_rounds_delta_and_captures_user(self, stub_db):
        asyncio.run(record_stock_movement(
            "r1", "i1", "Rice", "kg", -0.3333333, "sale_usage",
            ref_type="menu_item", ref_id="m1", user=USER,
            note="Recipe usage: Fried Rice", balance_after=9.6666666))
        doc = stub_db.stock_movements.inserted[0]
        assert doc["delta"] == -0.3333
        assert doc["balance_after"] == 9.6667
        assert doc["user_id"] == "u1"
        assert doc["movement_type"] == "sale_usage"

    def test_tenant_scoped_inventory_update_blocks_cross_tenant(self, stub_db):
        stub_db.inventory.docs["i1"] = {
            "id": "i1", "restaurant_id": "r1", "name": "Rice",
            "unit": "kg", "quantity": 10.0, "min_quantity": 2.0, "cost_per_unit": 40,
        }
        with pytest.raises(HTTPException) as e:
            asyncio.run(update_inventory_item(
                "i1", InventoryItemUpdate(quantity=8.0), user=OTHER_USER))
        assert e.value.status_code == 404
        # stock untouched
        assert stub_db.inventory.docs["i1"]["quantity"] == 10.0


# ──────────── Day close guard ────────────

class TestDayCloseGuard:
    def test_close_without_open_session_blocked(self, stub_db):
        with pytest.raises(HTTPException) as e:
            asyncio.run(close_day(closing_cash=0, force=False, user=USER))
        assert e.value.status_code == 400
        assert "no open day session" in str(e.value.detail).lower()


# ──────────── Kitchen gating: Ready-before-complete (KDS enabled only) ────────────

class TestKitchenGating:
    def _with_restaurant(self, stub_db, kitchen_enabled):
        stub_db.restaurants.docs["r1"] = {"id": "r1", "name": "T", "kitchen_enabled": kitchen_enabled, "tax_rate": 5.0}

    def test_kitchen_on_blocks_complete_before_ready(self, stub_db, monkeypatch):
        from server import update_order_status
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        self._with_restaurant(stub_db, True)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "preparing", "payment_status": "paid"}
        with pytest.raises(HTTPException) as e:
            asyncio.run(update_order_status("o1", OrderUpdate(status="completed"), user=USER))
        assert e.value.status_code == 400
        # Blocked either by transition guard or by the kitchen-ready rule
        assert "ready" in str(e.value.detail).lower() or "invalid status" in str(e.value.detail).lower()

    def test_kitchen_on_allows_complete_after_ready(self, stub_db, monkeypatch):
        from server import update_order_status
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        self._with_restaurant(stub_db, True)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "ready", "payment_status": "paid", "order_type": "takeaway"}
        res = asyncio.run(update_order_status("o1", OrderUpdate(status="completed"), user=USER))
        assert res.status == "completed"

    def test_kitchen_off_bypasses_ready_requirement(self, stub_db, monkeypatch):
        """No kitchen setup → order goes straight to billing; completion never blocked."""
        from server import update_order_status
        monkeypatch.setattr(server, "MANAGER_PIN", "")
        self._with_restaurant(stub_db, False)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "received", "payment_status": "paid", "order_type": "takeaway"}
        res = asyncio.run(update_order_status("o1", OrderUpdate(status="completed"), user=USER))
        assert res.status == "completed"

    def test_kitchen_on_blocks_pay_before_ready(self, stub_db, monkeypatch):
        from server import pay_order, OrderPayment
        self._with_restaurant(stub_db, True)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "received", "order_type": "dine_in", "table_number": 2}
        with pytest.raises(HTTPException) as e:
            asyncio.run(pay_order("o1", OrderPayment(payment_method="cash"), user=USER))
        assert e.value.status_code == 400

    def test_kitchen_off_allows_direct_pay(self, stub_db, monkeypatch):
        from server import pay_order, OrderPayment
        self._with_restaurant(stub_db, False)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "received", "order_type": "dine_in", "table_number": 2}
        stub_db.wallet_transactions.docs = {}
        res = asyncio.run(pay_order("o1", OrderPayment(payment_method="upi"), user=USER))
        assert res.payment_status == "paid"

    def test_split_tolerance_paise(self, stub_db, monkeypatch):
        """Split sums within ₹0.01 of the total are accepted (was ₹1.00)."""
        from server import pay_order, OrderPayment, PaymentSplit
        self._with_restaurant(stub_db, False)
        stub_db.orders.docs["o1"] = {**UNPAID_ORDER, "status": "ready", "order_type": "dine_in", "table_number": 3, "total_amount": 100.00}
        splits = [PaymentSplit(method="cash", amount=50.00), PaymentSplit(method="upi", amount=50.01)]
        res = asyncio.run(pay_order("o1", OrderPayment(payment_splits=splits), user=USER))
        assert res.payment_status == "paid"
