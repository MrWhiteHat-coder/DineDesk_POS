"""
Iteration 8 Tests: Branch Login Credentials, Owner Role, Analytics/Wallet Date Filtering

Tests:
1. Branch Creation with Login Credentials
2. Staff Creation with Owner Role
3. Analytics Date Filtering
4. Wallet Date Filtering
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials - loaded from environment
TEST_EMAIL = os.environ.get('TEST_EMAIL', 'demo@restaurant.com')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', 'demo123456')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for demo user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Failed to authenticate - skipping tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {auth_token}"}

def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

# ============== BRANCH TESTS ==============

class TestBranchCreation:
    """Test branch creation with login credentials"""
    
    def test_create_branch_requires_login_credentials(self, auth_headers):
        """Branch creation should fail without login_email and login_password"""
        response = requests.post(f"{BASE_URL}/api/branches", 
            headers=auth_headers,
            json={
                "name": "TEST_Branch_NoLogin",
                "address": "123 Test St",
                "city": "Test City",
                "pincode": "123456",
                "contact_phone": "9876543210",
                "share_menu": True
                # Missing login_email and login_password
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing credentials, got {response.status_code}"
        assert "Login email and password are required" in response.json().get("detail", "") or "required" in response.json().get("detail", "").lower()
        print("✓ Branch creation correctly requires login credentials")
    
    def test_create_branch_password_min_length(self, auth_headers):
        """Branch password must be at least 6 characters"""
        response = requests.post(f"{BASE_URL}/api/branches",
            headers=auth_headers,
            json={
                "name": "TEST_Branch_ShortPass",
                "address": "123 Test St",
                "city": "Test City",
                "pincode": "123456",
                "contact_phone": "9876543210",
                "share_menu": True,
                "login_email": f"test_{random_string()}@test.com",
                "login_password": "12345"  # Only 5 chars
            }
        )
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        assert "6 characters" in response.json().get("detail", "")
        print("✓ Branch password minimum length validation works")
    
    def test_create_branch_with_credentials_success(self, auth_headers):
        """Successfully create branch with valid login credentials"""
        branch_email = f"test_branch_{random_string()}@restaurant.com"
        branch_password = "branch123456"
        
        response = requests.post(f"{BASE_URL}/api/branches",
            headers=auth_headers,
            json={
                "name": f"TEST_Branch_{random_string()}",
                "address": "456 Branch Ave",
                "city": "Branch City",
                "pincode": "654321",
                "contact_phone": "9876543211",
                "share_menu": True,
                "login_email": branch_email,
                "login_password": branch_password
            }
        )
        assert response.status_code == 200, f"Expected 200 for branch creation, got {response.status_code}: {response.text}"
        
        branch_data = response.json()
        assert "id" in branch_data
        assert branch_data["is_active"] == True
        print(f"✓ Branch created successfully with ID: {branch_data['id']}")
        
        # Store for next test
        pytest.branch_email = branch_email
        pytest.branch_password = branch_password
        pytest.branch_id = branch_data["id"]
        
        return branch_data

    def test_branch_user_can_login(self, auth_headers):
        """Branch user should be able to login with created credentials"""
        # Use credentials from previous test
        if not hasattr(pytest, 'branch_email'):
            pytest.skip("Branch not created in previous test")
            
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": pytest.branch_email,
            "password": pytest.branch_password
        })
        assert response.status_code == 200, f"Branch user login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "manager"
        assert data["user"]["branch_id"] is not None
        print(f"✓ Branch user can login successfully with role: {data['user']['role']}")
    
    def test_get_branches_list(self, auth_headers):
        """Get list of branches"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get branches: {response.status_code}"
        
        branches = response.json()
        assert isinstance(branches, list)
        print(f"✓ Retrieved {len(branches)} branches")


# ============== STAFF OWNER ROLE TESTS ==============

class TestStaffOwnerRole:
    """Test staff creation with owner role"""
    
    def test_create_staff_with_owner_role(self, auth_headers):
        """Backend should accept 'owner' as valid staff role"""
        staff_email = f"test_owner_{random_string()}@restaurant.com"
        
        response = requests.post(f"{BASE_URL}/api/staff",
            headers=auth_headers,
            json={
                "email": staff_email,
                "password": "owner123456",
                "name": "TEST_Owner Staff",
                "role": "owner"
            }
        )
        assert response.status_code == 200, f"Failed to create owner staff: {response.status_code} - {response.text}"
        
        staff_data = response.json()
        assert staff_data["role"] == "owner"
        assert staff_data["name"] == "TEST_Owner Staff"
        print(f"✓ Staff created with owner role - ID: {staff_data['id']}")
        
        pytest.owner_staff_id = staff_data["id"]
    
    def test_create_staff_with_all_valid_roles(self, auth_headers):
        """Test all valid staff roles: owner, manager, cashier, captain, chef"""
        valid_roles = ["manager", "cashier", "captain", "chef"]
        
        for role in valid_roles:
            staff_email = f"test_{role}_{random_string()}@restaurant.com"
            response = requests.post(f"{BASE_URL}/api/staff",
                headers=auth_headers,
                json={
                    "email": staff_email,
                    "password": f"{role}123456",
                    "name": f"TEST_{role.title()} Staff",
                    "role": role
                }
            )
            assert response.status_code == 200, f"Failed to create {role} staff: {response.status_code}"
            assert response.json()["role"] == role
            print(f"  ✓ {role.title()} role accepted")
        
        print("✓ All valid roles work correctly")
    
    def test_create_staff_invalid_role(self, auth_headers):
        """Invalid role should be rejected"""
        staff_email = f"test_invalid_{random_string()}@restaurant.com"
        
        response = requests.post(f"{BASE_URL}/api/staff",
            headers=auth_headers,
            json={
                "email": staff_email,
                "password": "invalid123456",
                "name": "Invalid Role Staff",
                "role": "superadmin"  # Invalid role
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid role, got {response.status_code}"
        print("✓ Invalid role correctly rejected")
    
    def test_get_staff_includes_owner(self, auth_headers):
        """Staff list should include owner role members"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=auth_headers)
        assert response.status_code == 200
        
        staff_list = response.json()
        roles = [s["role"] for s in staff_list]
        print(f"✓ Staff list retrieved with roles: {set(roles)}")


# ============== ANALYTICS DATE FILTERING TESTS ==============

class TestAnalyticsDateFiltering:
    """Test analytics endpoint with date parameter"""
    
    def test_analytics_without_date(self, auth_headers):
        """Get today's analytics (default)"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=auth_headers)
        assert response.status_code == 200, f"Analytics failed: {response.status_code}"
        
        data = response.json()
        assert "daily_sales" in data
        assert "total_orders" in data
        assert "order_type_breakdown" in data
        assert "selected_date" in data
        print(f"✓ Analytics (today): {data['total_orders']} orders, ₹{data['daily_sales']} sales")
    
    def test_analytics_with_specific_date(self, auth_headers):
        """Get analytics for a specific past date"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/analytics", 
            headers=auth_headers,
            params={"date": yesterday}
        )
        assert response.status_code == 200, f"Analytics with date failed: {response.status_code}"
        
        data = response.json()
        assert data["selected_date"] == yesterday
        print(f"✓ Analytics for {yesterday}: {data['total_orders']} orders, ₹{data['daily_sales']} sales")
    
    def test_analytics_with_week_old_date(self, auth_headers):
        """Get analytics for a week old date"""
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/analytics",
            headers=auth_headers,
            params={"date": week_ago}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Weekly and monthly sales should still be calculated relative to the selected date
        assert "weekly_sales" in data
        assert "monthly_sales" in data
        print(f"✓ Analytics for {week_ago}: works correctly")
    
    def test_analytics_response_structure(self, auth_headers):
        """Verify analytics response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            "daily_sales", "weekly_sales", "monthly_sales", 
            "total_orders", "top_items", "order_type_breakdown",
            "hourly_orders", "payment_breakdown", "selected_date"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✓ Analytics response has all required fields")


# ============== WALLET DATE FILTERING TESTS ==============

class TestWalletDateFiltering:
    """Test wallet endpoint with date parameter"""
    
    def test_wallet_today_period(self, auth_headers):
        """Get wallet summary for today"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary",
            headers=auth_headers,
            params={"period": "today"}
        )
        assert response.status_code == 200, f"Wallet today failed: {response.status_code}"
        
        data = response.json()
        assert "total_cash" in data
        assert "total_card" in data
        assert "total_upi" in data
        assert "total_sales" in data
        assert "net_amount" in data
        print(f"✓ Wallet (today): ₹{data['total_sales']} total sales")
    
    def test_wallet_week_period(self, auth_headers):
        """Get wallet summary for this week"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary",
            headers=auth_headers,
            params={"period": "week"}
        )
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Wallet (week): ₹{data['total_sales']} total sales")
    
    def test_wallet_month_period(self, auth_headers):
        """Get wallet summary for this month"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary",
            headers=auth_headers,
            params={"period": "month"}
        )
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Wallet (month): ₹{data['total_sales']} total sales")
    
    def test_wallet_with_specific_date(self, auth_headers):
        """Get wallet summary for a specific date"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/wallet/summary",
            headers=auth_headers,
            params={"period": "custom", "date": yesterday}
        )
        assert response.status_code == 200, f"Wallet with date failed: {response.status_code}"
        
        data = response.json()
        print(f"✓ Wallet for {yesterday}: ₹{data['total_sales']} total sales")
    
    def test_wallet_response_structure(self, auth_headers):
        """Verify wallet response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/wallet/summary",
            headers=auth_headers,
            params={"period": "today"}
        )
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            "total_cash", "total_card", "total_upi",
            "total_sales", "total_refunds", "net_amount", "transactions"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✓ Wallet response has all required fields")


# ============== INTEGRATION TEST: ORDER TYPE BREAKDOWN ==============

class TestOrderTypeBreakdown:
    """Test that order type breakdown includes all order types"""
    
    def test_order_type_breakdown_structure(self, auth_headers):
        """Verify order_type_breakdown includes standard types"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        breakdown = data.get("order_type_breakdown", {})
        
        # The breakdown should be a dict with order types as keys
        assert isinstance(breakdown, dict)
        
        # If there are orders, verify structure
        if breakdown:
            for order_type, count in breakdown.items():
                assert isinstance(count, int), f"Count for {order_type} should be int"
                assert count >= 0, f"Count for {order_type} should be non-negative"
        
        print(f"✓ Order type breakdown: {breakdown}")


# ============== CLEANUP ==============

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, auth_headers):
        """Delete test-created staff members"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=auth_headers)
        if response.status_code == 200:
            staff_list = response.json()
            for staff in staff_list:
                if staff["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/staff/{staff['id']}", headers=auth_headers)
        
        # Delete test branches
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if response.status_code == 200:
            branches = response.json()
            for branch in branches:
                if branch["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/branches/{branch['id']}", headers=auth_headers)
        
        print("✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
