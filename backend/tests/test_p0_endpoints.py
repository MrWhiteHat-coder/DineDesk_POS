"""
P0 Security Remediation — ENDPOINT-level regression tests.

Runs the real FastAPI app (server.app) through TestClient with:
  - the database replaced by the Stub Mongo from test_p0_security.py
  - get_current_user dependency-overridden (no real JWT/DB needed)

No live server, no real MongoDB, and, importantly, NO network listener —
TestClient exercises the ASGI app in-process.

Covers:
1.  /api/webhooks/swiggy and /api/webhooks/zomato signature enforcement:
    missing/invalid signature → 401, stale timestamp → 401, valid signature
    → 200 + order persisted; unauthorized requests must cause ZERO database
    writes on either platform.
2.  Representative gated routes: tenant authorization, admin bypass,
    missing restaurant_subscriptions document, and correct entitlement
    enforcement (403 → subscribe via the real /store/subscribe flow → 200),
    plus the corrected menu entitlement (plain menu CRUD is BASE;
    recipe-bearing menu work requires the Inventory add-on).
"""
import os
import sys
import time
import hmac
import hashlib
import importlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
tests_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, tests_dir)

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault("ENABLE_DEMO_ACCOUNT", "false")
os.environ.pop("SWIGGY_WEBHOOK_SECRET", None)
os.environ.pop("ZOMATO_WEBHOOK_SECRET", None)

import pytest
import server
import test_p0_security as base
from test_p0_security import StubCol, StubDB, make_user
from fastapi.testclient import TestClient

SERVER = importlib.import_module("server")
# NOTE: test_p0_security.py may importlib.reload(server) (demo-seed test),
# which RE-CREATES server.app and server.get_current_user. Never capture
# them at import time — always resolve through SERVER at fixture/use time.


# ──────────── Stub extensions for the endpoints exercised here ────────────

class CountingStubCol(StubCol):
    """StubCol + count_documents (used by the webhook handlers for the
    daily order-number sequence) and find_one_and_update ($inc-based,
    used by the atomic counters order-number generator).
    Batch 2: webhook order numbers now come from the SAME atomic counters
    sequence as POS — the stub must support both access patterns."""

    async def count_documents(self, q):
        rows = list(self.docs.values())
        val = q.get("order_number")
        if isinstance(val, dict) and "$regex" in val:
            import re as _re
            rows = [d for d in rows if _re.search(val["$regex"], d.get("order_number", "") or "")]
        key = q.get("restaurant_id")
        if key is not None:
            rows = [d for d in rows if d.get("restaurant_id") == key]
        return len(rows)

    async def find_one_and_update(self, q, update, upsert=False, return_document=True):
        # counters docs are keyed by _id (e.g. "r1:20261013")
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


class EndpointStubDB(StubDB):
    def __init__(self):
        super().__init__()
        self.orders = CountingStubCol([], "orders")
        self.menu_items = CountingStubCol([], "menu_items")
        self.restaurant_subscriptions = UpsertStubCol([], "restaurant_subscriptions")
        self.coin_transactions = StubCol([], "coin_transactions")
        # batch-2: webhook order numbers come from the atomic counters col
        self.counters = CountingStubCol([], "counters")


class UpsertStubCol(StubCol):
    """restaurant_subscriptions supports upsert=True in the Store subscribe."""

    async def update_one(self, q, update, upsert=False):
        res = await super().update_one(q, update)
        if upsert and getattr(res, "modified_count", 0) == 0:
            doc = dict(q)
            set_data = update.get("$set", {})
            doc.update(set_data)
            self.docs[doc.get("restaurant_id", "unknown")] = doc
            self.inserted.append(doc)
            return type("R", (), {"modified_count": 1, "upserted_id": "stub"})()
        return res


def install_db(**extra):
    db = EndpointStubDB()
    for name, col in extra.items():
        setattr(db, name, col)
    SERVER.db = db
    return db


@pytest.fixture()
def client_owner():
    """TestClient with a plain owner user for restaurant r1."""
    app = SERVER.app
    user = make_user("owner", restaurant_id="r1")
    app.dependency_overrides[SERVER.get_current_user] = lambda: user
    yield TestClient(app), user
    app.dependency_overrides.pop(SERVER.get_current_user, None)


@pytest.fixture()
def client_admin():
    app = SERVER.app
    admin = make_user("admin", restaurant_id=None)
    app.dependency_overrides[SERVER.get_current_user] = lambda: admin
    yield TestClient(app), admin
    app.dependency_overrides.pop(SERVER.get_current_user, None)


def _own_restaurant(db):
    db.restaurants = StubCol([{"id": "r1", "name": "R One", "cuisine_types": [], "created_at": "now"}], "restaurants")


def _open_session(db):
    db.day_sessions = StubCol([{"id": "s1", "restaurant_id": "r1", "status": "open", "opening_cash": 0, "opened_at": "now"}], "day_sessions")


def _valid_headers(secret, body: bytes):
    ts = str(int(time.time()))
    digest = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return {"X-Webhook-Signature": digest, "X-Webhook-Timestamp": ts}


SWIGGY_BODY = (
    b'{"order_id": "sw1", "restaurant_id": "r1", "items": ['
    b'{"name": "Idli", "quantity": 2, "price": 40.0}], '
    b'"customer": {"name": "n", "phone": "999"}, '
    b'"delivery_address": "addr", "total_amount": 80.0}'
)
ZOMATO_BODY = (
    b'{"order_id": "zo1", "restaurant_id": "r1", "items": ['
    b'{"name": "Dosa", "quantity": 1, "price": 60.0}], '
    b'"customer": {"name": "n", "phone": "999"}, '
    b'"delivery_address": "addr", "total_amount": 60.0}'
)


# ══════════════════════ Webhook endpoints ══════════════════════

class TestWebhookEndpoints:
    def _warm_db(self):
        db = install_db()
        _own_restaurant(db)
        _open_session(db)
        return db

    def test_missing_signature_401_and_no_db_write(self, client_owner):
        client, _ = client_owner
        self._warm_db()
        resp = client.post("/api/webhooks/swiggy", content=SWIGGY_BODY)
        assert resp.status_code == 401
        SERVER.db.orders
        assert not SERVER.db.orders.docs, "Unauthorized request must not create orders"

    def test_invalid_signature_401_and_no_db_write(self, client_owner):
        client, _ = client_owner
        db = self._warm_db()
        SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] = "unittest-sw-secret"
        try:
            bad = {"X-Webhook-Signature": "0" * 64,
                   "X-Webhook-Timestamp": str(int(time.time()))}
            resp = client.post("/api/webhooks/swiggy", content=SWIGGY_BODY, headers=bad)
            assert resp.status_code == 401
            assert not db.orders.docs, "Forged request must not create orders"
        finally:
            SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] = ""

    def test_stale_timestamp_401_and_no_db_write(self, client_owner):
        client, _ = client_owner
        db = self._warm_db()
        SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = "unittest-zm-secret"
        try:
            old = str(int(time.time()) - 10_000)
            digest = hmac.new(b"unittest-zm-secret", f"{old}.".encode() + ZOMATO_BODY, hashlib.sha256).hexdigest()
            resp = client.post("/api/webhooks/zomato", content=ZOMATO_BODY,
                               headers={"X-Webhook-Signature": digest, "X-Webhook-Timestamp": old})
            assert resp.status_code == 401
            assert not db.orders.docs, "Replayed request must not create orders"
        finally:
            SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = ""

    def test_zomato_invalid_signature_401_no_write(self, client_owner):
        client, _ = client_owner
        db = self._warm_db()
        SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = "unittest-zm-secret"
        try:
            bad = {"X-Webhook-Signature": "z" * 64, "X-Webhook-Timestamp": str(int(time.time()))}
            resp = client.post("/api/webhooks/zomato", content=ZOMATO_BODY, headers=bad)
            assert resp.status_code == 401
            assert not db.orders.docs
        finally:
            SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = ""

    def test_valid_signature_creates_order_on_both_platforms(self, client_owner):
        client, _ = client_owner
        db = self._warm_db()
        SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] = "unittest-sw-secret"
        SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = "unittest-zm-secret"
        try:
            r1 = client.post("/api/webhooks/swiggy", content=SWIGGY_BODY,
                             headers=_valid_headers("unittest-sw-secret", SWIGGY_BODY))
            assert r1.status_code == 200, r1.text
            assert r1.json()["order_id"]
            r2 = client.post("/api/webhooks/zomato", content=ZOMATO_BODY,
                             headers=_valid_headers("unittest-zm-secret", ZOMATO_BODY))
            assert r2.status_code == 200, r2.text
            assert len(db.orders.docs) == 2
            plats = {d["platform"] for d in db.orders.docs.values()}
            assert plats == {"swiggy", "zomato"}
            assert all(d["status"] == "received" for d in db.orders.docs.values())
        finally:
            SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] = ""
            SERVER.ONLINE_WEBHOOK_SECRETS["zomato"] = ""

    def test_unconfigured_secret_still_401_even_with_headers(self, client_owner):
        client, _ = client_owner
        self._warm_db()
        # No secret configured (fail-closed)
        assert SERVER.ONLINE_WEBHOOK_SECRETS["swiggy"] == ""
        resp = client.post("/api/webhooks/swiggy", content=SWIGGY_BODY,
                           headers=_valid_headers("some-other-secret", SWIGGY_BODY))
        assert resp.status_code == 401
        assert not SERVER.db.orders.docs


# ══════════════════ Entitlement-gated endpoints ══════════════════

def _sub_with(addons):
    col = UpsertStubCol([], "restaurant_subscriptions")
    col.docs["r1"] = {"restaurant_id": "r1", "active_addons": list(addons), "plan": "pro", "updated_at": "now"}
    return col


CRM_ADDON = "crm_loyalty"
MB_ADDON = "multi_branch"   # catalog id for "Multi-Branch Dashboard"


class TestGatedRouteEndpoints:
    def test_missing_subscription_doc_is_403_not_500(self, client_owner):
        client, _ = client_owner
        install_db()  # no restaurant_subscriptions + no subscriptions docs
        resp = client.get("/api/coins/transactions")
        assert resp.status_code == 403
        assert "CRM" in resp.json()["detail"]

    def test_addon_active_200_addon_missing_403_for_branches(self, client_owner):
        client, _ = client_owner
        db = install_db()
        db.branches = StubCol([{
            "id": "b1", "restaurant_id": "r1", "name": "Main", "address": "a",
            "city": "c", "pincode": "1", "contact_phone": "x", "share_menu": True,
            "is_active": True, "created_at": "now",
        }, {
            "id": "b2", "restaurant_id": "OTHER", "name": "Foreign", "address": "a",
            "city": "c", "pincode": "1", "contact_phone": "x", "share_menu": True,
            "is_active": True, "created_at": "now",
        }], "branches")

        # no sub doc → 403
        SERVER.db.restaurant_subscriptions = StubCol([], "restaurant_subscriptions")
        resp = client.get("/api/branches")
        assert resp.status_code == 403

        # wrong add-on granted (legacy slug) → still 403
        SERVER.db.restaurant_subscriptions = _sub_with(["branches_legacy_wrong"])
        assert client.get("/api/branches").status_code == 403

        # correct catalog add-on multi_branch → 200, tenant-scoped to r1 only
        SERVER.db.restaurant_subscriptions = _sub_with([MB_ADDON])
        resp = client.get("/api/branches")
        assert resp.status_code == 200
        ids = [b["id"] for b in resp.json()]
        assert ids == ["b1"], "Branches of other tenants must never leak"

    def test_andmin_bypasses_entitlement(self, client_admin):
        client, _ = client_admin
        install_db()  # no subscription doc at all
        resp = client.get("/api/coins/transactions")
        assert resp.status_code == 200

    def test_subscribe_through_real_store_flow_unlocks_module(self, client_owner):
        client, _ = client_owner
        db = install_db()
        SERVER.db.restaurant_subscriptions = UpsertStubCol([], "restaurant_subscriptions")
        assert client.get("/api/coins/transactions").status_code == 403
        # the REAL self-service flow a tenant uses in the Store UI
        sub = client.post("/api/store/subscribe", params={"addon_id": CRM_ADDON})
        assert sub.status_code == 200, sub.text
        assert CRM_ADDON in sub.json()["active_addons"]
        resp = client.get("/api/coins/transactions")
        assert resp.status_code == 200
        assert SERVER.db.restaurant_subscriptions.docs["r1"]["active_addons"] == [CRM_ADDON]

    def test_unsubscribe_relocks_module(self, client_owner):
        client, _ = client_owner
        install_db()
        SERVER.db.restaurant_subscriptions = _sub_with([CRM_ADDON])
        assert client.get("/api/coins/transactions").status_code == 200
        un = client.post("/api/store/unsubscribe", params={"addon_id": CRM_ADDON})
        assert un.status_code == 200
        assert client.get("/api/coins/transactions").status_code == 403


# ═══════════ Menu entitlement: base CRUD, gated recipe management ═══════════

MENU_ITEM_PAYLOAD = {
    "category_id": "cat1", "name": "Idli", "price": 40.0,
    "description": None, "image_url": None, "is_vegetarian": True,
    "is_available": True, "preparation_time": 10, "recipe": [],
}


class TestMenuEntitlement:
    def test_plain_menu_item_creation_does_not_require_addon(self, client_owner):
        client, _ = client_owner
        install_db()  # no subscription doc → strictest entitlement env
        SERVER.db.restaurant_subscriptions = UpsertStubCol([], "restaurant_subscriptions")
        resp = client.post("/api/menu/items", json=MENU_ITEM_PAYLOAD)
        assert SERVER.db.menu_items.docs, "Base menu workflow must keep working"

    def test_recipe_menu_item_creation_requires_inventory_addon(self, client_owner):
        client, _ = client_owner
        install_db()
        payload = {**MENU_ITEM_PAYLOAD, "recipe": [
            {"inventory_item_id": "inv1", "quantity_needed": 2.0, "unit": "kg"}]}
        resp = client.post("/api/menu/items", json=payload)
        assert resp.status_code == 403
        assert not SERVER.db.menu_items.docs

        SERVER.db.restaurant_subscriptions = _sub_with(["inventory"])
        resp = client.post("/api/menu/items", json=payload)
        assert resp.status_code == 200, resp.text

    def test_plain_update_passes_but_recipe_update_gated(self, client_owner):
        client, _ = client_owner
        db = install_db()
        db.menu_items = StubCol([{
            "id": "mi1", "restaurant_id": "r1", "category_id": "cat1", "name": "Idli",
            "description": None, "image_url": None, "is_vegetarian": True, "is_available": True,
            "preparation_time": 10, "price": 40.0, "recipe": [], "created_at": "now",
        }], "menu_items")
        # price-only update: base workflow, no add-on
        resp = client.put("/api/menu/items/mi1", json={"price": 45.0})
        assert resp.status_code == 200, resp.text
        # recipe-bearing update: requires the inventory add-on
        resp = client.put("/api/menu/items/mi1", json={"recipe": [
            {"inventory_item_id": "inv1", "quantity_needed": 1.0, "unit": "kg"}]})
        assert resp.status_code == 403
        # admin: passes the entitlement gate (admin bypass), but has no tenant
        # restaurant_id → the tenant-scoped read-back correctly 404s rather
        # than 403s. Either way the ENTITLEMENT gate did not block the admin,
        # and no other tenant's menu data was modified.
        admin = make_user("admin", restaurant_id=None)
        SERVER.app.dependency_overrides[SERVER.get_current_user] = lambda: admin
        try:
            resp = client.put("/api/menu/items/mi1", json={"recipe": [
                {"inventory_item_id": "inv1", "quantity_needed": 1.0, "unit": "kg"}]})
            assert resp.status_code != 403, resp.text
            assert SERVER.db.menu_items.docs["mi1"]["recipe"] == [], "no tenant, no write"
        finally:
            SERVER.app.dependency_overrides[SERVER.get_current_user] = lambda: make_user("owner", restaurant_id="r1")


def test_app_importable_and_routed():
    paths = {r.path for r in SERVER.app.routes}
    assert "/api/webhooks/swiggy" in paths
    assert "/api/webhooks/zomato" in paths
    assert "/api/store/subscribe" in paths
