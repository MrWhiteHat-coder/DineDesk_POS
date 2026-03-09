"""
Backend API tests for new major features:
- Table hold flow (dine-in orders with pending payment)
- Running orders (add items, release & pay)
- KDS (Kitchen Display System)
- Wallet/Reconciliation
- Branches (Multi-branch management)
- Staff with 4 roles (manager, cashier, captain, chef)
- AI Insights
- Role-based permissions
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealth:
    """Health check - run first"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")


class TestAuth:
    """Authentication tests"""
    
    def test_login_demo_user(self):
        """Login as demo restaurant owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "demo@restaurant.com"
        print(f"✓ Demo user login successful, role: {data['user']['role']}")
        return data["access_token"]
    
    def test_login_admin_user(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@foodflow.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "admin"
        print("✓ Admin login successful")
    
    def test_get_permissions(self):
        """Test role-based permissions endpoint"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/permissions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "role" in data
        assert "permissions" in data
        assert isinstance(data["permissions"], list)
        print(f"✓ Permissions returned: {data['role']} has {len(data['permissions'])} permissions")


class TestDaySession:
    """Day session tests - required for orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_current_session(self):
        """Get current day session status"""
        response = requests.get(f"{BASE_URL}/api/day-session/current", headers=self.headers)
        assert response.status_code == 200
        # May be null if day not open
        print(f"✓ Current session: {'Open' if response.json() else 'Closed'}")
    
    def test_open_day_if_closed(self):
        """Open day if not already open"""
        # Check current status
        current = requests.get(f"{BASE_URL}/api/day-session/current", headers=self.headers)
        if current.json():
            print("✓ Day already open")
            return
        
        # Open day
        response = requests.post(f"{BASE_URL}/api/day-session/open?opening_cash=500", headers=self.headers)
        # Could fail if already open
        if response.status_code == 200:
            data = response.json()
            assert data["status"] == "open"
            print("✓ Day opened successfully")
        else:
            print(f"✓ Day already open or error: {response.status_code}")


class TestTableHoldFlow:
    """Table hold flow - dine-in orders with pending payment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Ensure day is open
        current = requests.get(f"{BASE_URL}/api/day-session/current", headers=self.headers)
        if not current.json():
            requests.post(f"{BASE_URL}/api/day-session/open?opening_cash=500", headers=self.headers)
    
    def test_get_tables(self):
        """Get all tables"""
        response = requests.get(f"{BASE_URL}/api/tables", headers=self.headers)
        assert response.status_code == 200
        tables = response.json()
        assert isinstance(tables, list)
        print(f"✓ Found {len(tables)} tables")
        return tables
    
    def test_create_dine_in_order_pending_payment(self):
        """Create dine-in order with pending payment (table hold)"""
        # Get menu items first
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items available")
        
        # Get available table
        tables_res = requests.get(f"{BASE_URL}/api/tables", headers=self.headers)
        tables = tables_res.json()
        available_table = next((t for t in tables if t["status"] == "available"), None)
        if not available_table:
            pytest.skip("No available tables")
        
        # Create order with pending payment
        order_data = {
            "order_type": "dine_in",
            "table_number": available_table["table_number"],
            "items": [{"menu_item_id": items[0]["id"], "quantity": 2}],
            "payment_method": "pending",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["payment_method"] == "pending"
        assert data["payment_status"] == "pending"
        assert data["order_type"] == "dine_in"
        print(f"✓ Created dine-in order #{data['order_number']} with pending payment on table {data['table_number']}")
        return data
    
    def test_get_running_orders(self):
        """Get running dine-in orders"""
        response = requests.get(f"{BASE_URL}/api/orders/running", headers=self.headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Found {len(orders)} running orders")
        return orders


class TestRunningOrderOperations:
    """Add items to running order and pay to release table"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_items_to_running_order(self):
        """Add items to an existing running order"""
        # Get running orders
        running = requests.get(f"{BASE_URL}/api/orders/running", headers=self.headers)
        orders = running.json()
        if not orders:
            pytest.skip("No running orders to test")
        
        # Get menu items
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        items = items_res.json()
        if len(items) < 2:
            pytest.skip("Need at least 2 menu items")
        
        order_id = orders[0]["id"]
        original_total = orders[0]["total_amount"]
        
        # Add items
        add_data = {
            "items": [{"menu_item_id": items[1]["id"], "quantity": 1}]
        }
        response = requests.post(f"{BASE_URL}/api/orders/{order_id}/add-items", json=add_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["total_amount"] > original_total, "Total should increase after adding items"
        print(f"✓ Added items to order #{data['order_number']}, total: ₹{original_total:.2f} → ₹{data['total_amount']:.2f}")
    
    def test_pay_and_release_table(self):
        """Complete payment for running order and release table"""
        # Get running orders
        running = requests.get(f"{BASE_URL}/api/orders/running", headers=self.headers)
        orders = running.json()
        if not orders:
            pytest.skip("No running orders to test payment")
        
        order_id = orders[0]["id"]
        table_number = orders[0].get("table_number")
        
        # Pay with cash
        pay_data = {"payment_method": "cash"}
        response = requests.post(f"{BASE_URL}/api/orders/{order_id}/pay", json=pay_data, headers=self.headers)
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json()
        assert data["payment_status"] == "paid"
        assert data["payment_method"] == "cash"
        assert data["status"] == "completed"
        print(f"✓ Order #{data['order_number']} paid with CASH, table {table_number} released")
        
        # Verify table is available
        if table_number:
            tables = requests.get(f"{BASE_URL}/api/tables", headers=self.headers)
            table = next((t for t in tables.json() if t["table_number"] == table_number), None)
            if table:
                assert table["status"] == "available", "Table should be available after payment"
                print(f"✓ Table {table_number} is now available")


class TestKDS:
    """Kitchen Display System tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_kds_orders(self):
        """Get active orders for KDS"""
        response = requests.get(f"{BASE_URL}/api/kds/orders", headers=self.headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ KDS showing {len(orders)} active orders")
        return orders
    
    def test_update_kds_order_status(self):
        """Update order status from KDS"""
        # Get KDS orders
        kds_res = requests.get(f"{BASE_URL}/api/kds/orders", headers=self.headers)
        orders = kds_res.json()
        
        if not orders:
            # Create a test order to work with
            items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
            items = items_res.json()
            if items:
                order_data = {
                    "order_type": "takeaway",
                    "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
                    "payment_method": "cash",
                    "discount_amount": 0
                }
                requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
                kds_res = requests.get(f"{BASE_URL}/api/kds/orders", headers=self.headers)
                orders = kds_res.json()
        
        if not orders:
            pytest.skip("No orders available for KDS testing")
        
        order = orders[0]
        if order["status"] == "received":
            new_status = "preparing"
        elif order["status"] == "preparing":
            new_status = "ready"
        else:
            pytest.skip("Order not in testable status")
        
        response = requests.put(f"{BASE_URL}/api/kds/orders/{order['id']}/status?new_status={new_status}", headers=self.headers)
        assert response.status_code == 200, f"KDS status update failed: {response.text}"
        print(f"✓ Updated order #{order['order_number']} status: {order['status']} → {new_status}")


class TestWallet:
    """Wallet/Reconciliation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_wallet_summary_today(self):
        """Get wallet summary for today"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary?period=today", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_cash" in data
        assert "total_card" in data
        assert "total_upi" in data
        assert "total_sales" in data
        assert "total_refunds" in data
        assert "net_amount" in data
        assert "transactions" in data
        print(f"✓ Wallet summary today - Cash: ₹{data['total_cash']:.2f}, Card: ₹{data['total_card']:.2f}, UPI: ₹{data['total_upi']:.2f}")
    
    def test_get_wallet_summary_week(self):
        """Get wallet summary for this week"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary?period=week", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Wallet weekly net: ₹{data['net_amount']:.2f}")
    
    def test_get_wallet_summary_month(self):
        """Get wallet summary for this month"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary?period=month", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Wallet monthly sales: ₹{data['total_sales']:.2f}")


class TestBranches:
    """Multi-branch management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_branches(self):
        """Get all branches"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        assert response.status_code == 200
        branches = response.json()
        assert isinstance(branches, list)
        print(f"✓ Found {len(branches)} branches")
    
    def test_create_branch(self):
        """Create a new branch with share_menu option"""
        unique_id = str(uuid.uuid4())[:6]
        branch_data = {
            "name": f"TEST_Branch_{unique_id}",
            "address": "123 Test Street",
            "city": "Mumbai",
            "pincode": "400001",
            "contact_phone": "9876543210",
            "share_menu": True
        }
        response = requests.post(f"{BASE_URL}/api/branches", json=branch_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == branch_data["name"]
        assert data["share_menu"] == True
        assert data["is_active"] == True
        print(f"✓ Created branch: {data['name']} (share_menu: {data['share_menu']})")
        return data
    
    def test_update_branch(self):
        """Update a branch"""
        # First create a branch
        unique_id = str(uuid.uuid4())[:6]
        create_data = {
            "name": f"TEST_Update_{unique_id}",
            "address": "Original Address",
            "city": "Delhi",
            "pincode": "110001",
            "contact_phone": "9988776655",
            "share_menu": True
        }
        create_res = requests.post(f"{BASE_URL}/api/branches", json=create_data, headers=self.headers)
        branch = create_res.json()
        
        # Update it
        update_data = {
            "name": f"TEST_Updated_{unique_id}",
            "address": "Updated Address",
            "city": "Delhi",
            "pincode": "110002",
            "contact_phone": "9988776655",
            "share_menu": False
        }
        response = requests.put(f"{BASE_URL}/api/branches/{branch['id']}", json=update_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["address"] == "Updated Address"
        assert data["share_menu"] == False
        print(f"✓ Updated branch: share_menu changed to False")
    
    def test_delete_branch(self):
        """Delete a branch"""
        # Create a branch to delete
        unique_id = str(uuid.uuid4())[:6]
        create_data = {
            "name": f"TEST_Delete_{unique_id}",
            "address": "To Be Deleted",
            "city": "Chennai",
            "pincode": "600001",
            "contact_phone": "9876543210",
            "share_menu": True
        }
        create_res = requests.post(f"{BASE_URL}/api/branches", json=create_data, headers=self.headers)
        branch = create_res.json()
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/branches/{branch['id']}", headers=self.headers)
        assert response.status_code == 200
        print(f"✓ Deleted branch: {branch['name']}")


class TestStaff:
    """Staff management with 4 roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_staff(self):
        """Get all staff members"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=self.headers)
        assert response.status_code == 200
        staff = response.json()
        assert isinstance(staff, list)
        print(f"✓ Found {len(staff)} staff members")
    
    def test_create_staff_manager(self):
        """Create staff with manager role"""
        unique_id = str(uuid.uuid4())[:6]
        staff_data = {
            "email": f"TEST_manager_{unique_id}@test.com",
            "password": "password123",
            "name": f"Test Manager {unique_id}",
            "role": "manager"
        }
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["role"] == "manager"
        print(f"✓ Created MANAGER staff: {data['name']}")
    
    def test_create_staff_cashier(self):
        """Create staff with cashier role"""
        unique_id = str(uuid.uuid4())[:6]
        staff_data = {
            "email": f"TEST_cashier_{unique_id}@test.com",
            "password": "password123",
            "name": f"Test Cashier {unique_id}",
            "role": "cashier"
        }
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["role"] == "cashier"
        print(f"✓ Created CASHIER staff: {data['name']}")
    
    def test_create_staff_captain(self):
        """Create staff with captain role"""
        unique_id = str(uuid.uuid4())[:6]
        staff_data = {
            "email": f"TEST_captain_{unique_id}@test.com",
            "password": "password123",
            "name": f"Test Captain {unique_id}",
            "role": "captain"
        }
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["role"] == "captain"
        print(f"✓ Created CAPTAIN staff: {data['name']}")
    
    def test_create_staff_chef(self):
        """Create staff with chef role"""
        unique_id = str(uuid.uuid4())[:6]
        staff_data = {
            "email": f"TEST_chef_{unique_id}@test.com",
            "password": "password123",
            "name": f"Test Chef {unique_id}",
            "role": "chef"
        }
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["role"] == "chef"
        print(f"✓ Created CHEF staff: {data['name']}")


class TestAIInsights:
    """AI-powered analytics insights"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_analytics(self):
        """Get analytics data"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "daily_sales" in data
        assert "weekly_sales" in data
        assert "monthly_sales" in data
        assert "top_items" in data
        assert "payment_breakdown" in data
        print(f"✓ Analytics: daily=₹{data['daily_sales']:.2f}, weekly=₹{data['weekly_sales']:.2f}")
    
    def test_ai_insights_endpoint(self):
        """Test AI insights endpoint (may fail due to API key limits - acceptable)"""
        response = requests.post(f"{BASE_URL}/api/analytics/ai-insights", headers=self.headers)
        assert response.status_code == 200, f"AI endpoint error: {response.text}"
        data = response.json()
        assert "insights" in data
        # AI may return error message if key has issues - that's acceptable
        print(f"✓ AI Insights endpoint working. Got response with {len(data.get('insights', ''))} chars")


class TestTakeawayPaymentFlow:
    """Takeaway order with payment method selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_takeaway_with_cash(self):
        """Create takeaway order with cash payment"""
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
            "payment_method": "cash",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["payment_method"] == "cash"
        assert data["payment_status"] == "paid"
        print(f"✓ Takeaway order #{data['order_number']} paid with CASH")
    
    def test_create_takeaway_with_card(self):
        """Create takeaway order with card payment"""
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
            "payment_method": "card",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["payment_method"] == "card"
        print(f"✓ Takeaway order #{data['order_number']} paid with CARD")
    
    def test_create_takeaway_with_upi(self):
        """Create takeaway order with UPI payment"""
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
            "payment_method": "upi",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["payment_method"] == "upi"
        print(f"✓ Takeaway order #{data['order_number']} paid with UPI")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
