"""
P0 Security Remediation — regression tests (in-process, Stub Mongo mirrors
backend/tests/test_reliability.py so no live server or real database needed).

Covers the six approved security fixes:
1.  Webhook signature enforcement (swiggy/zomato fail-closed without secret)
2.  Branch update never persists plaintext login_password on the branch doc
3.  PUT /tables/{id}/status: role check, status whitelist, running-order guard
4.  Cross-tenant customer update/read-back is tenant-scoped (404, not leaked)
5.  Server-side add-on entitlement enforcement (403 without add-on, 200 with)
6.  Demo tenant seeding is OFF by default; explicit opt-in enables it

No request bodies, tokens, passwords or OTPs are logged by these tests.
"""
import os
import sys
import asyncio
import time
import hmac
import hashlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault("ENABLE_DEMO_ACCOUNT", "false")
os.environ.pop("SWIGGY_WEBHOOK_SECRET", None)
os.environ.pop("ZOMATO_WEBHOOK_SECRET", None)
os.environ["WEBHOOK_TIMESTAMP_TOLERANCE_SECS"] = "300"

import pytest
from fastapi import HTTPException

# Python 3.10+ has no implicit event loop in the main thread — run async
# coroutine calls through asyncio.run explicitly.
def run(coro):
    return asyncio.run(coro)

import server
from server import (
    require_addon,
    update_table_status,
    update_customer,
    update_branch,
    swiggy_webhook,
    zomato_webhook,
    verify_webhook_signature,
    verify_password,
    BranchCreate,
    CustomerUpdate,
    ENABLE_DEMO_ACCOUNT,
)


# ──────────── Stub Mongo (mirrors test_reliability.py) ────────────

class StubCol:
    """Minimal async stub for Motor collections — supports the exact query
    shapes this test suite exercises."""

    def __init__(self, docs=None, coll_name=""):
        self.docs = {d["id"]: dict(d) for d in (docs or [])}
        self.name = coll_name
        self.inserted = []
        self.updated = []

    @staticmethod
    def _match(doc, key, val):
        if isinstance(val, dict) and "$nin" in val:
            return doc.get(key) not in val["$nin"]
        if isinstance(val, dict) and "$in" in val:
            return doc.get(key) in val["$in"]
        if isinstance(val, dict) and "$ne" in val:
            return doc.get(key) != val["$ne"]
        if isinstance(val, dict) and "$regex" in val:
            import re as _re
            return bool(_re.search(val["$regex"], doc.get(key, "") or ""))
        return doc.get(key) == val

    async def find_one(self, q, proj=None):
        """Multi-field AND match (keys may be id, restaurant_id, role, …)."""
        for doc in self.docs.values():
            if all(self._match(doc, k, v) for k, v in q.items()):
                return dict(doc)
        return None

    async def update_one(self, q, update):
        for doc in self.docs.values():
            if all(self._match(doc, k, v) for k, v in q.items()):
                set_data = update.get("$set", {})
                inc_data = update.get("$inc", {})
                unset_data = update.get("$unset", {})
                doc.update(set_data)
                for k, v in inc_data.items():
                    doc[k] = doc.get(k, 0) + v
                for k in unset_data:
                    doc.pop(k, None)
                self.updated.append((dict(q), {**set_data, **inc_data}))
                return type("R", (), {"modified_count": 1, "upserted_id": None})()
        return type("R", (), {"modified_count": 0, "upserted_id": None})()

    async def insert_one(self, doc):
        d = dict(doc)
        self.inserted.append(d)
        self.docs[d["id"]] = d
        return type("R", (), {"inserted_id": "stub"})()

    def find(self, q, proj=None):
        rows = [dict(d) for d in self.docs.values()]
        if "restaurant_id" in q:
            rows = [d for d in rows if d.get("restaurant_id") == q["restaurant_id"]]
        if "status" in q:
            sv = q["status"]
            if isinstance(sv, dict) and "$nin" in sv:
                rows = [d for d in rows if d.get("status") not in sv["$nin"]]
            elif isinstance(sv, dict) and "$in" in sv:
                rows = [d for d in rows if d.get("status") in sv["$in"]]
            else:
                rows = [d for d in rows if d.get("status") == sv]
        if "is_active" in q:
            rows = [d for d in rows if d.get("is_active") == q["is_active"]]
        # batch-2: $or groups (CRM history legacy fallback) + general equality
        if "$or" in q:
            def _matches_or(doc, ors):
                for cond in ors:
                    if all(self._match(doc, k, v) for k, v in cond.items()):
                        return True
                return False
            ors = q["$or"]
            if isinstance(ors, list):
                rows = [d for d in rows if _matches_or(d, ors)]
        for k, v in q.items():
            if k in ("restaurant_id", "status", "is_active", "$or"):
                continue
            if isinstance(v, dict):
                rows = [d for d in rows if self._match(d, k, v)]
            else:
                rows = [d for d in rows if d.get(k) == v]

        class Q:
            _rows = rows
            _proj = proj
            _sort_key = None
            _reverse = False
            _limit = None
            _skip = 0

            def sort(self, key, direction):
                self._sort_key = key
                self._reverse = direction == -1
                return self

            def skip(self, n):
                self._skip = n
                return self

            def limit(self, n):
                self._limit = n
                return self

            async def to_list(self, n=None):
                out = self._rows
                if self._sort_key:
                    out = sorted(out, key=lambda d: d.get(self._sort_key, ""), reverse=self._reverse)
                out = out[self._skip:]
                if self._limit is not None:
                    out = out[: self._limit]
                elif n is not None:
                    out = out[:n]
                return out
        return Q()


class StubDB:
    def __init__(self):
        self.empty = lambda: StubCol([], "empty")
        # collections used by the fixes
        self.tables = self.empty()
        self.customers = self.empty()
        self.orders = self.empty()
        self.branches = self.empty()
        self.users = self.empty()
        self.restaurants = self.empty()
        self.restaurant_subscriptions = self.empty()
        self.day_sessions = self.empty()
        self.audit_logs = self.empty()
        self.system_logs = self.empty()
        self.wastage = self.empty()
        self.stock_movements = self.empty()
        self.notifications = self.empty()
        self.wallet_transactions = self.empty()

    def __getitem__(self, name):
        if not hasattr(self, name):
            setattr(self, name, StubCol([], name))
        return getattr(self, name)


# ──────────── Auth fixture factory ────────────

def make_user(role="owner", restaurant_id="r1", branch_id=None):
    return {"id": "u-" + role, "email": role + "@x", "name": role, "role": role,
            "restaurant_id": restaurant_id, "branch_id": branch_id}


# ════════════════════════════════════════════════════════════════════
# FIX 1: webhooks
# ════════════════════════════════════════════════════════════════════

class TestFix1_Webhooks:
    def _sig(self, secret, body, ts=None):
        ts = ts if ts is not None else int(time.time())
        return f"{ts}.{body}", str(ts), hmac.new(secret.encode(), f"{ts}.".encode() + body.encode(), hashlib.sha256).hexdigest()

    def test_no_secret_configured_rejects_401(self):
        # (default env in this process: no provider secrets set)
        with pytest.raises(HTTPException) as exc:
            verify_webhook_signature("swiggy", b"{}", "x", "1")
        assert exc.value.status_code == 401

    def test_missing_signature_rejects_401_with_secret(self):
        server.ONLINE_WEBHOOK_SECRETS["swiggy"] = "unittest-sw-secret"
        try:
            with pytest.raises(HTTPException) as exc:
                verify_webhook_signature("swiggy", b"{}", "", "")
            assert exc.value.status_code == 401
        finally:
            server.ONLINE_WEBHOOK_SECRETS["swiggy"] = ""

    def test_valid_signature_accepted_and_signature_mismatch_rejected(self):
        secret = "unittest-sw-secret"
        server.ONLINE_WEBHOOK_SECRETS["swiggy"] = secret
        body = b'{"restaurant_id": "r1", "order_id": "ex1", "items": [], "customer": {"name": "n"}, "delivery_address": "a", "total_amount": 100.0}'
        ts, ts_hdr, digest = self._sig(secret, body.decode())
        try:
            # valid signature → NO exception raised
            verify_webhook_signature("swiggy", body, digest, ts_hdr)
            # forged signature (bad digest) → 401
            with pytest.raises(HTTPException) as exc:
                verify_webhook_signature("swiggy", body, "0" * 64, ts_hdr)
            assert exc.value.status_code == 401
        finally:
            server.ONLINE_WEBHOOK_SECRETS["swiggy"] = ""

    def test_replayed_stale_timestamp_rejected_401(self):
        secret = "unittest-sw-secret"
        server.ONLINE_WEBHOOK_SECRETS["swiggy"] = secret
        ts = int(time.time()) - 10_000
        body = b"{}"
        digest = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
        try:
            with pytest.raises(HTTPException) as exc:
                verify_webhook_signature("swiggy", body, digest, str(ts))
            assert exc.value.status_code == 401
        finally:
            server.ONLINE_WEBHOOK_SECRETS["swiggy"] = ""


# ════════════════════════════════════════════════════════════════════
# FIX 2: branch plaintext password
# ════════════════════════════════════════════════════════════════════

class TestFix2_BranchPassword:
    def _setup_server_db(self):
        server.db = StubDB()
        server.db.branches = StubCol([{"id": "b1", "restaurant_id": "r1", "name": "Branch A", "city": "c", "pincode": "p", "address": "a", "contact_phone": "x", "share_menu": True, "is_active": True, "created_at": "now", "login_email": "mgr@x"}], "branches")
        server.db.users = StubCol([{"id": "u1", "email": "mgr@x", "password": "oldhash", "name": "mgr", "role": "manager", "restaurant_id": "r1", "branch_id": "b1", "is_active": True, "is_verified": True, "created_at": "now"}], "users")

    def test_branch_doc_never_gets_plaintext_password(self):
        self._setup_server_db()
        data = BranchCreate(name="Branch A Updated", address="a2", city="c2", pincode="p2",
                            contact_phone="x2", share_menu=True, login_email="mgr@x", login_password="NEWPASS123")
        resp = run(update_branch("b1", data, make_user("owner")))
        stored_branch = server.db.branches.docs["b1"]
        assert "login_password" not in stored_branch, "Plaintext password must never be persisted"
        assert stored_branch["login_email"] == "mgr@x", "login_email must stay under management control"
        # name update DID go through
        assert stored_branch["name"] == "Branch A Updated"

    def test_branch_password_rotation_hashes_on_user_doc(self):
        self._setup_server_db()
        data = BranchCreate(name="Branch A", address="a", city="c", pincode="p",
                            contact_phone="x", share_menu=True, login_email="mgr@x", login_password="NEWPASS123")
        run(update_branch("b1", data, make_user("owner")))
        users = server.db.users.docs
        # old hash replaced by a new bcrypt hash; not the plaintext
        hashed = users["u1"]["password"]
        assert hashed != "oldhash"
        assert hashed != "NEWPASS123"
        assert verify_password("NEWPASS123", hashed)

    def test_branch_email_change_is_rejected_not_silently_written(self):
        self._setup_server_db()
        data = BranchCreate(name="B", address="a", city="c", pincode="p", contact_phone="x",
                            share_menu=True, login_email="evil@x", login_password="NEWPASS123")
        with pytest.raises(HTTPException) as exc:
            run(update_branch("b1", data, make_user("owner")))
        assert exc.value.status_code == 400


# ════════════════════════════════════════════════════════════════════
# FIX 3: tables
# ════════════════════════════════════════════════════════════════════

class TestFix3_Tables:
    def _mk_table(self, current_order_id=None, status="available"):
        return {"id": "t1", "restaurant_id": "r1", "table_number": 1, "capacity": 4,
                "status": status, "current_order_id": current_order_id}

    def _setup(self, order_running=False):
        server.db = StubDB()
        server.db.tables = StubCol([self._mk_table("o1" if order_running else None, "occupied" if order_running else "available")], "tables")
        if order_running:
            server.db.orders = StubCol([{"id": "o1", "restaurant_id": "r1", "status": "preparing", "order_number": "1", "order_type": "dine_in", "table_number": 1, "items": [], "total_amount": 100.0, "payment_method": "pending", "payment_status": "pending", "day_session_id": "s1", "created_at": "now"}], "orders")

    def test_invalid_status_rejected_400(self):
        self._setup()
        with pytest.raises(HTTPException) as exc:
            run(
                update_table_status("t1", "destroyed", make_user("owner")))
        assert exc.value.status_code == 400

    def test_valid_statuses_accepted(self):
        self._setup()
        for s in ["available", "occupied", "reserved"]:
            resp = run(
                update_table_status("t1", s, make_user("owner")))
            assert resp["message"] == "Table status updated"

    def test_role_forbidden_chef_403(self):
        self._setup()
        with pytest.raises(HTTPException) as exc:
            run(
                update_table_status("t1", "reserved", make_user("chef")))
        assert exc.value.status_code == 403

    def test_chef_and_cashier_rejected_captain_allowed(self):
        # Backend ROLE_ACCESS: chef {'kds'} and cashier {'dashboard','menu_order',
        # 'wallet','analytics'} have NO 'tables' → both must be rejected.
        # captain {'menu_order','tables','kds'} DOES have 'tables' → allowed.
        self._setup()
        with pytest.raises(HTTPException) as exc_cashier:
            run(
                update_table_status("t1", "available", make_user("cashier")))
        assert exc_cashier.value.status_code == 403
        with pytest.raises(HTTPException) as exc_chef:
            run(
                update_table_status("t1", "available", make_user("chef")))
        assert exc_chef.value.status_code == 403
        run(
            update_table_status("t1", "available", make_user(role="captain")))  # must NOT raise

    def test_free_table_with_running_order_rejected_409(self):
        self._setup(order_running=True)
        with pytest.raises(HTTPException) as exc:
            run(
                update_table_status("t1", "available", make_user("owner")))
        assert exc.value.status_code == 409

    def test_free_table_no_running_order_OK(self):
        self._setup(order_running=False)
        resp = run(
            update_table_status("t1", "available", make_user("owner")))
        assert resp["message"] == "Table status updated"


# ════════════════════════════════════════════════════════════════════
# FIX 4: cross-tenant customer
# ════════════════════════════════════════════════════════════════════

class TestFix4_CustomerTenancy:
    def _setup(self):
        server.db = StubDB()
        server.db.customers = StubCol([{"id": "c-OTHER", "restaurant_id": "OTHER-TENANT", "name": "Outside", "phone": "+911234567890", "email": None, "date_of_birth": None, "anniversary_date": None, "tags": [], "preferences": None, "allergies": None, "loyalty_points": 0, "tier": "silver", "wallet_balance": 0, "total_visits": 0, "total_spent": 0, "last_visit_at": None, "created_at": "now"}], "customers")

    def test_cross_tenant_update_is_404_not_leak(self):
        self._setup()
        data = CustomerUpdate(name="Hijacked")
        with pytest.raises(HTTPException) as exc:
            run(
                update_customer("c-OTHER", data, make_user("owner", restaurant_id="r1")))
        assert exc.value.status_code == 404
        # the 'other' tenant's data was never modified:
        assert server.db.customers.docs["c-OTHER"]["name"] == "Outside"

    def test_same_tenant_update_succeeds(self):
        self._setup()
        server.db.customers = StubCol([{"id": "c-MINE", "restaurant_id": "r1", "name": "Original", "phone": "+911234567890", "email": None, "date_of_birth": None, "anniversary_date": None, "tags": [], "preferences": None, "allergies": None, "loyalty_points": 0, "tier": "silver", "wallet_balance": 0, "total_visits": 0, "total_spent": 0, "last_visit_at": None, "created_at": "now"}], "customers")
        data = CustomerUpdate(name="Renamed")
        resp = run(
            update_customer("c-MINE", data, make_user("owner", restaurant_id="r1")))
        assert resp.name == "Renamed"


# ════════════════════════════════════════════════════════════════════
# FIX 5: add-on entitlement enforcement
# ════════════════════════════════════════════════════════════════════

class TestFix5_Entitlements:
    def _no_sub(self):
        server.db = StubDB()
        server.db.restaurant_subscriptions = StubCol([], "restaurant_subscriptions")

    def _with_sub(self, addon):
        # restaurant_subscriptions docs key by restaurant_id (no "id" field)
        col = StubCol([], "restaurant_subscriptions")
        col.docs["r1"] = {"restaurant_id": "r1", "active_addons": [addon], "plan": "pro", "updated_at": "now"}
        server.db = StubDB()
        server.db.restaurant_subscriptions = col

    @pytest.mark.parametrize("feature", ["inventory", "crm_loyalty", "branches", "analytics", "gift_cards"])
    def test_403_when_addon_active_missing(self, feature):
        self._no_sub()
        with pytest.raises(HTTPException) as exc:
            run(require_addon(feature, make_user("owner")))
        assert exc.value.status_code == 403

    @pytest.mark.parametrize("feature,addon", [
        ("inventory", "inventory"),
        ("purchase_orders", "inventory"),
        ("wastage", "inventory"),
        ("crm_loyalty", "crm_loyalty"),
        ("branches", "multi_branch"),
        ("analytics", "analytics_pro"),
        ("gift_cards", "gift_cards"),
    ])
    def test_200_when_addon_active(self, feature, addon):
        self._with_sub(addon)
        run(require_addon(feature, make_user("owner")))

    def test_admin_bypasses_entitlement(self):
        self._no_sub()
        run(require_addon("inventory", make_user("admin", restaurant_id=None)))

    def test_base_features_not_addon_gated(self):
        self._no_sub()
        run(require_addon("menu_order", make_user("owner")))


# ════════════════════════════════════════════════════════════════════
# FIX 6: demo seeding off by default
# ════════════════════════════════════════════════════════════════════

class TestFix6_DemoSeeding:
    def test_default_is_disabled(self):
        # The process env did NOT enable it; default must be off.
        assert ENABLE_DEMO_ACCOUNT is False

    def test_explicit_opt_in_works(self):
        os.environ["ENABLE_DEMO_ACCOUNT"] = "true"
        import importlib
        try:
            mod = importlib.reload(server)
            assert mod.ENABLE_DEMO_ACCOUNT is True
        finally:
            os.environ["ENABLE_DEMO_ACCOUNT"] = "false"
            importlib.reload(server)


def test_server_module_importable():
    assert server.app is not None
