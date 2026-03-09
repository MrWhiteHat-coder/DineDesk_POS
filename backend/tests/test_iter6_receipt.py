"""
Iteration 6 Test Suite: Receipt Printing & Dashboard Order Detail Features
Tests:
1. Receipt API - GET /api/orders/{order_id}/receipt
2. Create Order flow with receipt generation
3. Dashboard orders endpoint - GET /api/orders/today
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for demo restaurant user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@restaurant.com",
        "password": "demo123456"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def menu_items(api_client):
    """Get available menu items for ordering"""
    response = api_client.get(f"{BASE_URL}/api/menu/items")
    assert response.status_code == 200
    items = response.json()
    available_items = [item for item in items if item.get("is_available", True)]
    assert len(available_items) > 0, "No available menu items found"
    return available_items


class TestReceiptAPI:
    """Test receipt generation API endpoint"""
    
    def test_create_takeaway_order_and_get_receipt(self, api_client, menu_items):
        """Create a takeaway order and verify receipt API returns correct data"""
        # Create a takeaway order with cash payment (completed immediately)
        order_data = {
            "order_type": "takeaway",
            "table_number": None,
            "items": [
                {
                    "menu_item_id": menu_items[0]["id"],
                    "quantity": 2,
                    "notes": "Test receipt order"
                }
            ],
            "payment_method": "cash",
            "discount_amount": 0
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_response.status_code == 200, f"Order creation failed: {create_response.text}"
        
        order = create_response.json()
        order_id = order.get("id")
        assert order_id, "Order ID not returned"
        
        # Now fetch receipt for this order
        receipt_response = api_client.get(f"{BASE_URL}/api/orders/{order_id}/receipt")
        assert receipt_response.status_code == 200, f"Receipt fetch failed: {receipt_response.text}"
        
        receipt = receipt_response.json()
        
        # Validate receipt structure
        assert "restaurant" in receipt, "Receipt missing restaurant data"
        assert "order" in receipt, "Receipt missing order data"
        
        # Validate restaurant info in receipt
        restaurant = receipt["restaurant"]
        assert "name" in restaurant, "Receipt restaurant missing name"
        assert "address" in restaurant, "Receipt restaurant missing address"
        assert "city" in restaurant, "Receipt restaurant missing city"
        assert "phone" in restaurant, "Receipt restaurant missing phone"
        
        # Validate order info in receipt
        order_data = receipt["order"]
        assert order_data.get("order_number"), "Receipt missing order number"
        assert order_data.get("order_type") == "takeaway", "Order type mismatch"
        assert order_data.get("payment_method") == "cash", "Payment method mismatch"
        assert "items" in order_data, "Receipt missing items"
        assert len(order_data["items"]) > 0, "Receipt has no items"
        assert "total_amount" in order_data, "Receipt missing total amount"
        
        print(f"Receipt API test PASSED - Order #{order_data.get('order_number')}")
        return order_id

    def test_receipt_404_for_invalid_order(self, api_client):
        """Receipt API should return 404 for non-existent order"""
        fake_order_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/orders/{fake_order_id}/receipt")
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}"
        print("Receipt 404 test PASSED")

    def test_create_dinein_order_pending_then_pay_and_receipt(self, api_client, menu_items):
        """Create dine-in order with pending payment, then pay and get receipt"""
        # Get available tables
        tables_response = api_client.get(f"{BASE_URL}/api/tables")
        assert tables_response.status_code == 200
        tables = tables_response.json()
        available_tables = [t for t in tables if t.get("status") == "available"]
        
        if not available_tables:
            pytest.skip("No available tables for dine-in order test")
        
        table_number = available_tables[0]["table_number"]
        
        # Create dine-in order with pending payment
        order_data = {
            "order_type": "dine_in",
            "table_number": table_number,
            "items": [
                {
                    "menu_item_id": menu_items[0]["id"],
                    "quantity": 1,
                    "notes": "Dine-in receipt test"
                }
            ],
            "payment_method": "pending",
            "discount_amount": 0
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_response.status_code == 200, f"Dine-in order failed: {create_response.text}"
        
        order = create_response.json()
        order_id = order.get("id")
        
        # Pay for the order
        pay_response = api_client.post(f"{BASE_URL}/api/orders/{order_id}/pay", json={
            "payment_method": "card"
        })
        assert pay_response.status_code == 200, f"Payment failed: {pay_response.text}"
        
        # Now fetch receipt
        receipt_response = api_client.get(f"{BASE_URL}/api/orders/{order_id}/receipt")
        assert receipt_response.status_code == 200, f"Receipt after payment failed: {receipt_response.text}"
        
        receipt = receipt_response.json()
        assert receipt["order"]["payment_method"] == "card", "Payment method not updated in receipt"
        
        print(f"Dine-in receipt test PASSED - Order #{receipt['order'].get('order_number')}")


class TestTodaysOrdersAPI:
    """Test today's orders API for dashboard detail modal"""
    
    def test_get_todays_orders(self, api_client):
        """Get today's orders for dashboard display"""
        response = api_client.get(f"{BASE_URL}/api/orders/today")
        assert response.status_code == 200, f"Today's orders API failed: {response.text}"
        
        orders = response.json()
        assert isinstance(orders, list), "Expected list of orders"
        
        # If we have orders, validate structure
        if len(orders) > 0:
            order = orders[0]
            assert "id" in order, "Order missing id"
            assert "order_number" in order, "Order missing order_number"
            assert "order_type" in order, "Order missing order_type"
            assert "status" in order, "Order missing status"
            assert "total_amount" in order, "Order missing total_amount"
            assert "items" in order, "Order missing items for detail view"
            
            # Each item should have name, quantity, total for display
            if len(order["items"]) > 0:
                item = order["items"][0]
                assert "name" in item, "Item missing name"
                assert "quantity" in item, "Item missing quantity"
        
        print(f"Today's orders API PASSED - Found {len(orders)} orders")


class TestOrderWithPaymentMethod:
    """Test order creation with different payment methods"""
    
    @pytest.mark.parametrize("payment_method", ["cash", "card", "upi"])
    def test_takeaway_order_with_payment_method(self, api_client, menu_items, payment_method):
        """Create takeaway orders with different payment methods"""
        order_data = {
            "order_type": "takeaway",
            "table_number": None,
            "items": [
                {
                    "menu_item_id": menu_items[0]["id"],
                    "quantity": 1,
                    "notes": f"Test {payment_method} payment"
                }
            ],
            "payment_method": payment_method,
            "discount_amount": 0
        }
        
        response = api_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Order with {payment_method} failed: {response.text}"
        
        order = response.json()
        assert order.get("payment_method") == payment_method, f"Payment method mismatch"
        
        # Verify receipt shows correct payment method
        receipt_response = api_client.get(f"{BASE_URL}/api/orders/{order['id']}/receipt")
        assert receipt_response.status_code == 200
        
        receipt = receipt_response.json()
        assert receipt["order"]["payment_method"] == payment_method
        
        print(f"Order with {payment_method} payment PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
