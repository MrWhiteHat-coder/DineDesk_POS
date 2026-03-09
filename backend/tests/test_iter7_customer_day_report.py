"""
Iteration 7 Tests: Customer Details at Checkout & Day Close Report PDF + AI Insights
- Customer lookup API
- Orders with customer details
- Day session AI insights
- Day session PDF report
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestCustomerLookup:
    """Test customer phone lookup API for auto-suggest feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_customer_lookup_endpoint_exists(self):
        """GET /api/customers/lookup should respond"""
        response = requests.get(f"{BASE_URL}/api/customers/lookup", headers=self.headers, params={"phone": "9999"})
        # Should return 200 with empty list or results
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Customer lookup returned: {response.json()}")
    
    def test_customer_lookup_with_short_phone(self):
        """Lookup with less than 3 chars should return empty"""
        response = requests.get(f"{BASE_URL}/api/customers/lookup", headers=self.headers, params={"phone": "99"})
        assert response.status_code == 200
        # Should return empty or all matches
        print(f"Short phone lookup: {response.json()}")


class TestOrderWithCustomerDetails:
    """Test creating orders with customer name, phone, email"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Login failed - skipping tests")
        
        # Get menu items
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        if items_res.status_code == 200 and items_res.json():
            self.menu_item_id = items_res.json()[0]["id"]
        else:
            pytest.skip("No menu items available")
    
    def test_create_order_with_customer_details(self):
        """POST /api/orders with customer_name, customer_phone, customer_email"""
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": self.menu_item_id, "quantity": 1, "notes": None}],
            "payment_method": "cash",
            "discount_amount": 0,
            "customer_name": "TEST_John Doe",
            "customer_phone": "9876543210",
            "customer_email": "john@test.com"
        }
        response = requests.post(f"{BASE_URL}/api/orders", headers=self.headers, json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert "id" in order
        assert "order_number" in order
        print(f"Order created: {order['order_number']}")
        
        # Verify order has customer details in receipt
        receipt_res = requests.get(f"{BASE_URL}/api/orders/{order['id']}/receipt", headers=self.headers)
        assert receipt_res.status_code == 200
        receipt = receipt_res.json()
        assert receipt["order"].get("customer_name") == "TEST_John Doe"
        assert receipt["order"].get("customer_phone") == "9876543210"
        print(f"Receipt shows customer: {receipt['order'].get('customer_name')}, {receipt['order'].get('customer_phone')}")
    
    def test_create_order_without_customer_name(self):
        """Order should be created even without customer details (for flexibility)"""
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": self.menu_item_id, "quantity": 1, "notes": None}],
            "payment_method": "cash",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", headers=self.headers, json=order_data)
        # API should accept orders without customer details
        assert response.status_code == 200
        print(f"Order without customer details: {response.json().get('order_number')}")


class TestDaySessionAiInsights:
    """Test AI insights endpoint for day session"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Login failed - skipping tests")
        
        # Get current day session
        session_res = requests.get(f"{BASE_URL}/api/day-session/current", headers=self.headers)
        if session_res.status_code == 200 and session_res.json():
            self.session_id = session_res.json().get("id")
        else:
            pytest.skip("No day session found")
    
    def test_ai_insights_endpoint(self):
        """GET /api/day-session/{id}/ai-insights returns AI insights"""
        response = requests.get(f"{BASE_URL}/api/day-session/{self.session_id}/ai-insights", headers=self.headers)
        assert response.status_code == 200, f"AI insights failed: {response.text}"
        
        data = response.json()
        assert "insights" in data
        # AI insights may be empty or unavailable, but key should exist
        print(f"AI insights response: {data.get('insights', '')[:200]}...")


class TestDaySessionPdf:
    """Test PDF report endpoint for day session"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Login failed - skipping tests")
        
        # Get current day session
        session_res = requests.get(f"{BASE_URL}/api/day-session/current", headers=self.headers)
        if session_res.status_code == 200 and session_res.json():
            self.session_id = session_res.json().get("id")
        else:
            pytest.skip("No day session found")
    
    def test_pdf_endpoint_returns_pdf(self):
        """GET /api/day-session/{id}/report-pdf returns application/pdf"""
        response = requests.get(f"{BASE_URL}/api/day-session/{self.session_id}/report-pdf", headers=self.headers)
        assert response.status_code == 200, f"PDF endpoint failed: {response.status_code}"
        
        # Check content type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got: {content_type}"
        
        # Check content is binary PDF (starts with %PDF)
        content = response.content
        assert content[:4] == b'%PDF', f"Content doesn't start with %PDF: {content[:20]}"
        print(f"PDF generated successfully, size: {len(content)} bytes")


class TestCustomerLookupFlow:
    """Test the customer lookup flow after creating order with customer details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@restaurant.com",
            "password": "demo123456"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Login failed - skipping tests")
        
        # Get menu items
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=self.headers)
        if items_res.status_code == 200 and items_res.json():
            self.menu_item_id = items_res.json()[0]["id"]
        else:
            pytest.skip("No menu items available")
    
    def test_create_order_then_lookup_customer(self):
        """Create order with customer phone, then verify lookup returns that customer"""
        unique_phone = "TEST9998887770"
        
        # Create order with unique phone
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": self.menu_item_id, "quantity": 1, "notes": None}],
            "payment_method": "cash",
            "discount_amount": 0,
            "customer_name": "TEST_AutoSuggest User",
            "customer_phone": unique_phone,
            "customer_email": "autosuggest@test.com"
        }
        create_res = requests.post(f"{BASE_URL}/api/orders", headers=self.headers, json=order_data)
        assert create_res.status_code == 200, f"Order creation failed: {create_res.text}"
        print(f"Order created with phone: {unique_phone}")
        
        # Now lookup customer by phone (use first 3+ chars)
        lookup_res = requests.get(f"{BASE_URL}/api/customers/lookup", headers=self.headers, params={"phone": "TEST999"})
        assert lookup_res.status_code == 200
        
        suggestions = lookup_res.json()
        print(f"Lookup results: {suggestions}")
        
        # Verify our customer is in suggestions
        found = any(s.get("phone") == unique_phone for s in suggestions)
        assert found, f"Customer with phone {unique_phone} not found in suggestions: {suggestions}"
        print(f"Customer auto-suggest working! Found {unique_phone} in suggestions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
