"""
Backend API Tests for FoodFlow POS Platform
Tests the redesigned POS interface backend APIs including:
- Authentication (login with demo credentials)
- Day Session (open/close)
- Menu (categories, items)
- Orders (create, update status)
- Tables
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dine-flow-19.preview.emergentagent.com')

# Test data
DEMO_USER = {
    "email": "demo@restaurant.com",
    "password": "demo123456"
}

ADMIN_USER = {
    "email": "admin@foodflow.com",
    "password": "admin123"
}


class TestHealthEndpoints:
    """Health check endpoints"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API Root: {data['message']}")
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")


class TestAuthentication:
    """Authentication tests"""
    
    def test_demo_user_login(self):
        """Test login with demo restaurant owner credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == DEMO_USER["email"]
        print(f"✓ Demo user login successful: {data['user']['name']}")
        return data["access_token"]
    
    def test_admin_login(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['name']}")
        return data["access_token"]
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_get_me_endpoint(self):
        """Test getting current user info"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        token = login_response.json()["access_token"]
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == DEMO_USER["email"]
        print(f"✓ Get me endpoint working: {data['name']}")


class TestDaySession:
    """Day session (open/close) tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_current_session(self, auth_token):
        """Test getting current day session"""
        response = requests.get(
            f"{BASE_URL}/api/day-session/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print(f"✓ Get current session: status {response.status_code}")
    
    def test_day_session_history(self, auth_token):
        """Test getting day session history"""
        response = requests.get(
            f"{BASE_URL}/api/day-session/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Day session history: {len(data)} sessions found")


class TestMenuManagement:
    """Menu categories and items tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_categories(self, auth_token):
        """Test getting menu categories"""
        response = requests.get(
            f"{BASE_URL}/api/menu/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Menu categories: {len(data)} categories found")
        if data:
            print(f"  Categories: {[c['name'] for c in data]}")
    
    def test_get_menu_items(self, auth_token):
        """Test getting menu items"""
        response = requests.get(
            f"{BASE_URL}/api/menu/items",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Menu items: {len(data)} items found")
        if data:
            print(f"  Sample items: {[i['name'] for i in data[:3]]}")
    
    def test_create_category(self, auth_token):
        """Test creating a new category"""
        test_category = {
            "name": f"TEST_Category_{datetime.now().timestamp()}",
            "description": "Test category for automated testing",
            "sort_order": 99
        }
        response = requests.post(
            f"{BASE_URL}/api/menu/categories",
            json=test_category,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_category["name"]
        print(f"✓ Created category: {data['name']}")
        return data["id"]


class TestOrders:
    """Order management tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_orders(self, auth_token):
        """Test getting orders"""
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Orders: {len(data)} orders found")
    
    def test_get_today_orders(self, auth_token):
        """Test getting today's orders"""
        response = requests.get(
            f"{BASE_URL}/api/orders/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Today's orders: {len(data)} orders")


class TestTables:
    """Table management tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_tables(self, auth_token):
        """Test getting tables"""
        response = requests.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Tables: {len(data)} tables found")
        if data:
            available_tables = [t for t in data if t["status"] == "available"]
            print(f"  Available tables: {len(available_tables)}")


class TestAnalytics:
    """Analytics tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_analytics(self, auth_token):
        """Test getting analytics"""
        response = requests.get(
            f"{BASE_URL}/api/analytics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "daily_sales" in data
        assert "total_orders" in data
        print(f"✓ Analytics: daily_sales=${data['daily_sales']}, total_orders={data['total_orders']}")


class TestInventory:
    """Inventory tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_inventory(self, auth_token):
        """Test getting inventory"""
        response = requests.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Inventory: {len(data)} items found")


class TestStaff:
    """Staff management tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return response.json()["access_token"]
    
    def test_get_staff(self, auth_token):
        """Test getting staff"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Staff: {len(data)} staff members found")


class TestAdmin:
    """Admin panel tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return response.json()["access_token"]
    
    def test_admin_stats(self, admin_token):
        """Test getting admin stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_restaurants" in data
        print(f"✓ Admin stats: {data['total_restaurants']} restaurants, {data['total_users']} users")
    
    def test_admin_restaurants(self, admin_token):
        """Test getting all restaurants"""
        response = requests.get(
            f"{BASE_URL}/api/admin/restaurants",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin restaurants: {len(data)} restaurants found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
