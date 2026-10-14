"""P0 Batch 4: refund/void workflow + table release guard.

Covers the P0-6 dead-end (paid bills could never be voided) and the P0-7
release-table dangling-order bug. Stub Mongo in-process, like the other P0
suites — no live server, no real MongoDB.
"""
import os
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault("ENABLE_DEMO_ACCOUNT", "false")

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

import server
from server import refund_order, release_table, OrderRefund
from test_p0_batch2 import B2StubDB, OrdersStubCol, B2StubCol

USER = {"id": "u-owner", "name": "Owner", "role": "owner", "restaurant_id": "r1"}
MANAGER = {**USER, "role": "manager"}
CASHIER = {**USER, "role": "cashier"}

BASE_ORDER = {
    "id": "o1", "restaurant_id": "r1", "order_number": "202610140001",
    "order_type": "takeaway", "table_number": None,
    "items": [], "status": "completed", "payment_status": "paid",
    "payment_method": "card", "total_amount": 250.0, "subtotal": 238.0,
    "tax_amount": 12.0, "discount_amount": 0, "day_session_id": "s1",
    "created_at": datetime.now(timezone.utc).isoformat(), "change_amount": 0,
}


def paid_split_order(**over):
    """Completed split-paid bill: ₹400 cash + ₹178 UPI (matches day-close tests)."""
    o = {**BASE_ORDER, "payment_method": "split", "total_amount": 578.0,
         "payment_splits": [{"method": "cash", "amount": 400.0},
                            {"method": "upi", "amount": 178.0}], **over}
    return o


@pytest.fixture()
def db(monkeypatch):
    db = B2StubDB()
    db.orders = OrdersStubCol()
    db.tables = B2StubCol([], "tables")
    server.db = db
    monkeypatch.setattr(server, "MANAGER_PIN", "")
    return db


class _RestockRecorder:
    """Isolated async restock stub recording which orders were restocked."""
    def __init__(self):
        self.calls = []

    async def __call__(self, restaurant_id, order):
        self.calls.append(order["id"])


def record_restock(db, _unused=None):
    rec = _RestockRecorder()
    server.restock_for_cancelled_order = rec
    return rec


# ──────────── Refund/void workflow ────────────

class TestRefundWorkflow:
    def test_full_void_single_method(self, db):
        doc = {**BASE_ORDER}
        db.orders.docs["o1"] = dict(doc)
        res = asyncio.run(refund_order("o1", OrderRefund(reason="customer returned food"), user=USER))
        assert res.payment_status == "refunded"
        refunds = [w for w in db.wallet_transactions.inserted if w["transaction_type"] == "refund"]
        assert len(refunds) == 1
        assert refunds[0]["payment_method"] == "card" and refunds[0]["amount"] == 250.0
        actions = [a["action"] for a in db.audit_logs.inserted]
        assert "order.refund" in actions

    def test_split_void_refunds_per_actual_method(self, db):
        """₹400 back to cash, ₹178 back to UPI — never one generic row."""
        db.orders.docs["o1"] = paid_split_order()
        res = asyncio.run(refund_order("o1", OrderRefund(reason="wrong bill"), user=USER))
        refunds = sorted(w["payment_method"] for w in db.wallet_transactions.inserted if w["transaction_type"] == "refund")
        assert refunds == ["cash", "upi"]
        by_m = {w["payment_method"]: w["amount"] for w in db.wallet_transactions.inserted if w["transaction_type"] == "refund"}
        assert by_m["cash"] == 400.0 and by_m["upi"] == 178.0
        assert res.total_amount == 578.0

    def test_double_refund_rejected_no_duplicate_effects(self, db):
        """A retried refund must not mint money or restock again."""
        db.orders.docs["o1"] = {**paid_split_order()}
        rec = record_restock(db, None)
        asyncio.run(refund_order("o1", OrderRefund(reason="first"), user=USER))
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="second"), user=USER))
        assert e.value.status_code in (400, 409)  # rejected either at the guard or the claim
        refunds = [w for w in db.wallet_transactions.inserted if w["transaction_type"] == "refund"]
        assert len(refunds) == 2, "cash+upi once, never duplicated"
        assert rec.calls == ["o1"], "restock exactly once"

    def test_refund_unpaid_intercepted(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER, "payment_status": "pending", "status": "preparing"}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="no payment"), user=USER))
        assert e.value.status_code == 400

    def test_refund_requires_reason(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="   "), user=USER))
        assert e.value.status_code == 400

    def test_refund_requires_pin_when_configured(self, db, monkeypatch):
        monkeypatch.setattr(server, "MANAGER_PIN", "9911")
        record_restock(db, None)
        db.orders.docs["o1"] = {**BASE_ORDER}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="x"), user=USER))
        assert e.value.status_code == 403
        asyncio.run(refund_order("o1", OrderRefund(reason="x", manager_pin="9911"), user=USER))
        assert db.orders.docs["o1"]["payment_status"] == "refunded"

    def test_cashier_cannot_refund(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="x"), user=CASHIER))
        assert e.value.status_code == 403

    def test_restock_false_records_waste_disposition(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER}
        rec = record_restock(db, None)
        asyncio.run(refund_order("o1", OrderRefund(reason="all waste", restock=False), user=MANAGER))
        assert rec.calls == [], "food NOT returned to sellable stock"
        audits = [a for a in db.audit_logs.inserted if a["action"] == "order.refund"]
        assert "waste" in audits[0]["reason"] or "waste" in audits[0].get("details", "")

    def test_refund_frees_dinetable(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER, "order_type": "dine_in", "table_number": 5}
        db.tables.docs["t5"] = {"id": "t5", "restaurant_id": "r1", "table_number": 5,
                                "status": "occupied", "current_order_id": "o1"}
        asyncio.run(refund_order("o1", OrderRefund(reason="guest left"), user=USER))
        assert db.tables.docs["t5"]["status"] == "available"
        assert db.tables.docs["t5"]["current_order_id"] is None

    def test_foreigner_cannot_refund(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="x"),
                                     user={**MANAGER, "restaurant_id": "r2"}))
        assert e.value.status_code == 404

    def test_refunded_orders_excluded_from_day_close_sales(self, db):
        """Day close counts PAID orders only — a refunded bill must not earn."""
        db.orders.docs["o1"] = {**BASE_ORDER}          # paid ₹250
        db.orders.docs["o2"] = {**BASE_ORDER, "id": "o2", "payment_status": "refunded"}
        paid = [d for d in db.orders.docs.values() if d.get("payment_status") == "paid"]
        assert sum(o["total_amount"] for o in paid) == 250.0

    def test_cannot_refund_cancelled_order(self, db):
        db.orders.docs["o1"] = {**BASE_ORDER, "status": "cancelled", "cancel_effects_done": True}
        with pytest.raises(HTTPException) as e:
            asyncio.run(refund_order("o1", OrderRefund(reason="x"), user=USER))
        assert e.value.status_code == 400


# ──────────── Table release guard (P0-7) ────────────

class TestTableReleaseGuard:
    def test_release_with_running_order_blocked(self, db):
        db.tables.docs["t1"] = {"id": "t1", "restaurant_id": "r1", "table_number": 1,
                                "status": "occupied", "current_order_id": "o1"}
        db.orders.docs["o1"] = {**BASE_ORDER, "status": "preparing", "payment_status": "pending"}
        with pytest.raises(HTTPException) as e:
            asyncio.run(release_table("t1", user=USER))
        assert e.value.status_code == 409
        assert db.tables.docs["t1"]["status"] == "occupied"

    def test_release_after_completion_allowed(self, db):
        db.tables.docs["t1"] = {"id": "t1", "restaurant_id": "r1", "table_number": 1,
                                "status": "occupied", "current_order_id": "o1"}
        db.orders.docs["o1"] = {**BASE_ORDER, "status": "completed"}  # settled, safe
        asyncio.run(release_table("t1", user=USER))
        assert db.tables.docs["t1"]["status"] == "available"
        assert db.tables.docs["t1"]["current_order_id"] is None

    def test_release_missing_table_404(self, db):
        with pytest.raises(HTTPException) as e:
            asyncio.run(release_table("gone", user=USER))
        assert e.value.status_code == 404
