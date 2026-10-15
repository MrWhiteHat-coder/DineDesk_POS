"""P0 Batch 5: day-close cash-refund reconciliation.

Previously: refunded cash bills never touched the drawer math — close_day
aggregated only orders with payment_status == 'paid', and a cash bill that was
refunded during service left expected_cash overstated by exactly the refund.
Fixes under test (in-process stub Mongo):
  FIX 1  close_day stores a per-method refund_breakdown snapshot from the
         session's wallet 'refund' rows
  FIX 2  day report expected_cash = opening + cash collected − cash refunds;
         'difference' reflects the same rule
  FIX 3  report endpoint aggregates live wallet rows when the session doc has
         no stored snapshot (open session / legacy close)
Stub Mongo in-process, same pattern as the other P0 suites.
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
import server
from server import close_day, get_day_close_report
from test_p0_batch2 import B2StubDB, B2StubCol, b2_db, USER

ORDER_DOC = {
    "id": "ocash", "restaurant_id": "r1", "order_number": "N1",
    "order_type": "dine_in", "table_number": 1, "items": [],
    "status": "completed", "payment_status": "paid", "payment_method": "cash",
    "total_amount": 250.0, "subtotal": 238.0, "tax_amount": 12.0,
    "discount_amount": 0, "day_session_id": "s1",
    "created_at": datetime.now(timezone.utc).isoformat(), "change_amount": 0,
}


def _open_day(db, opening_cash=500.0):
    db.day_sessions = B2StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open",
                                  "opening_cash": opening_cash, "date": "2026-10-15",
                                  "opened_at": "2026-10-15T09:00:00+00:00"}], "day_sessions")
    db.orders = B2StubCol([dict(ORDER_DOC)], "orders")
    return db


class TestCloseDayRefundBreakdown:
    def test_close_records_per_method_refunds(self):
        """FIX 1: the session snapshot captures wallet refund rows per method."""
        db = _open_day(b2_db())
        # service saw a ₹250 cash sale refunded (order then payment_status='refunded')
        db.orders.docs["ocash"]["payment_status"] = "refunded"
        db.orders.docs["ocash"]["status"] = "refunded"
        db.wallet_transactions = B2StubCol([
            {"id": "w1", "restaurant_id": "r1", "transaction_type": "refund",
             "amount": 250.0, "payment_method": "cash", "reference_id": "ocash",
             "day_session_id": "s1"},
            # another refunded split bill: cash share + card share
            {"id": "w2", "restaurant_id": "r1", "transaction_type": "refund",
             "amount": 178.0, "payment_method": "upi", "reference_id": "o2",
             "day_session_id": "s1"},
        ], "wallet_transactions")

        res = asyncio.run(close_day(closing_cash=500.0, force=False, user={"id": "u",
                                     "email": "o@x", "name": "Owner", "role": "owner",
                                     "restaurant_id": "r1"}))
        assert res.cash_sales == 0.0  # refunded cash bill is not revenue
        assert res.refund_breakdown == {"cash": 250.0, "upi": 178.0}

    def test_session_doc_stores_snapshot(self):
        db = _open_day(b2_db())
        db.wallet_transactions = B2StubCol([], "wallet_transactions")
        user = {"id": "u", "email": "o@x", "name": "Owner", "role": "owner", "restaurant_id": "r1"}
        asyncio.run(close_day(closing_cash=500.0, force=False, user=user))
        stored = db.day_sessions.docs["s1"]
        assert stored["refund_breakdown"] == {}


class TestDayReportCashRefunds:
    def _closed_session(self, db, store_snapshot=True):
        session = {"id": "s1", "restaurant_id": "r1", "status": "closed",
                   "opening_cash": 500.0, "closing_cash": 750.0,
                   "total_sales": 250.0, "total_orders": 1,
                   "cash_sales": 250.0, "card_sales": 0, "upi_sales": 0,
                   "payment_breakdown": {"cash": 250.0},
                   "date": "2026-10-15",
                   "opened_at": "2026-10-15T09:00:00+00:00"}
        if store_snapshot:
            session["refund_breakdown"] = {"cash": 100.0}
        db.day_sessions = B2StubCol([session], "day_sessions")
        db.orders = B2StubCol([dict(ORDER_DOC)], "orders")  # ₹250 cash sale, paid
        db.wallet_transactions = B2StubCol([], "wallet_transactions")
        return db

    def test_expected_cash_subtracts_cash_refunds_from_snapshot(self):
        # opening 500 + cash sales 250 − refunded 100 = 650 expected; counted 750 → +100
        db = self._closed_session(b2_db())
        rep = asyncio.run(get_day_close_report("s1", user=USER))
        cs = rep["cash_summary"]
        assert cs["cash_refunds"] == 100.0
        assert cs["expected_cash"] == 650.0
        assert cs["difference"] == 100.0

    def test_legacy_session_aggregates_live_wallet_rows(self):
        """FIX 3: sessions closed before the snapshot existed still reconcile."""
        db = self._closed_session(b2_db(), store_snapshot=False)
        db.wallet_transactions = B2StubCol([
            {"id": "w1", "restaurant_id": "r1", "transaction_type": "refund",
             "amount": 100.0, "payment_method": "cash", "reference_id": "ocash",
             "day_session_id": "s1"},
        ], "wallet_transactions")
        rep = asyncio.run(get_day_close_report("s1", user=USER))
        assert rep["cash_summary"]["expected_cash"] == 650.0

    def test_open_session_also_reports_live_refunds(self):
        day = _open_day(b2_db())
        day.wallet_transactions = B2StubCol([
            {"id": "w1", "restaurant_id": "r1", "transaction_type": "refund",
             "amount": 250.0, "payment_method": "cash", "reference_id": "ocash",
             "day_session_id": "s1"},
        ], "wallet_transactions")
        # session still OPEN — legacy behavior ignored refunds entirely
        rep = asyncio.run(get_day_close_report("s1", user=USER))
        cs = rep["cash_summary"]
        assert cs["cash_refunds"] == 250.0
        assert cs["expected_cash"] == 500.0  # 500 opening + 0 net col'd − 250 refunded
        assert cs["closing_cash"] is None and cs["difference"] is None
