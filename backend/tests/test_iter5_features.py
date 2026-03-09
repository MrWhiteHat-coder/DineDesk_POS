"""
Backend API tests for iteration 5 features:
- Quick POS mode (same order API, but with receipt)
- Purchase Orders CRUD (create, list, receive, cancel)
- Receipt API (get receipt for completed order)
- Day Close Report (detailed session report)
- Dashboard Order Types (via analytics API)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_headers():
    """Login as demo user and return auth headers"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@restaurant.com",
        "password": "demo123456"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestQuickPOS:
    """Quick POS - create order and get receipt"""
    
    def test_get_menu_items(self, auth_headers):
        """Verify menu items are available for Quick POS"""
        response = requests.get(f"{BASE_URL}/api/menu/items", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "Need menu items for Quick POS"
        print(f"✓ Found {len(items)} menu items for Quick POS")
        return items
    
    def test_quick_order_with_cash(self, auth_headers):
        """Create quick takeaway order with cash payment"""
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=auth_headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 2}],
            "payment_method": "cash",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert response.status_code == 200, f"Order failed: {response.text}"
        data = response.json()
        assert data["payment_method"] == "cash"
        assert data["payment_status"] == "paid"
        assert "id" in data
        print(f"✓ Quick POS order #{data['order_number']} created with CASH")
        return data
    
    def test_quick_order_with_upi(self, auth_headers):
        """Create quick takeaway order with UPI payment"""
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=auth_headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
            "payment_method": "upi",
            "discount_amount": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["payment_method"] == "upi"
        print(f"✓ Quick POS order #{data['order_number']} created with UPI")
        return data


class TestReceiptAPI:
    """Receipt API - get receipt after order"""
    
    def test_get_receipt_for_order(self, auth_headers):
        """Create order and retrieve receipt"""
        # Create order first
        items_res = requests.get(f"{BASE_URL}/api/menu/items", headers=auth_headers)
        items = items_res.json()
        if not items:
            pytest.skip("No menu items")
        
        order_data = {
            "order_type": "takeaway",
            "items": [{"menu_item_id": items[0]["id"], "quantity": 1}],
            "payment_method": "cash",
            "discount_amount": 0
        }
        order_res = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert order_res.status_code == 200
        order = order_res.json()
        order_id = order["id"]
        
        # Get receipt
        receipt_res = requests.get(f"{BASE_URL}/api/orders/{order_id}/receipt", headers=auth_headers)
        assert receipt_res.status_code == 200, f"Receipt fetch failed: {receipt_res.text}"
        receipt = receipt_res.json()
        
        # Validate receipt structure
        assert "restaurant" in receipt, "Receipt should have restaurant info"
        assert "order" in receipt, "Receipt should have order info"
        assert "generated_at" in receipt, "Receipt should have timestamp"
        
        # Validate restaurant info
        assert "name" in receipt["restaurant"]
        
        # Validate order info
        assert receipt["order"]["id"] == order_id
        assert receipt["order"]["order_number"] == order["order_number"]
        assert "items" in receipt["order"]
        assert "total_amount" in receipt["order"]
        
        print(f"✓ Receipt fetched for order #{order['order_number']} from {receipt['restaurant']['name']}")
    
    def test_receipt_not_found(self, auth_headers):
        """Test receipt for non-existent order"""
        response = requests.get(f"{BASE_URL}/api/orders/non-existent-id/receipt", headers=auth_headers)
        assert response.status_code == 404


class TestPurchaseOrders:
    """Purchase Order CRUD tests"""
    
    def test_get_inventory_items(self, auth_headers):
        """Get inventory items for purchase orders"""
        response = requests.get(f"{BASE_URL}/api/inventory", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        print(f"✓ Found {len(items)} inventory items")
        return items
    
    def test_create_purchase_order(self, auth_headers):
        """Create a new purchase order"""
        # Get inventory items first
        inv_res = requests.get(f"{BASE_URL}/api/inventory", headers=auth_headers)
        inventory = inv_res.json()
        if not inventory:
            pytest.skip("No inventory items to create purchase order")
        
        unique_id = str(uuid.uuid4())[:6]
        po_data = {
            "supplier_name": f"TEST_Supplier_{unique_id}",
            "supplier_contact": "9876543210",
            "notes": "Test purchase order",
            "expected_delivery": None,
            "items": [
                {
                    "inventory_item_id": inventory[0]["id"],
                    "inventory_item_name": inventory[0]["name"],
                    "quantity": 10,
                    "unit": inventory[0].get("unit", "kg"),
                    "unit_cost": inventory[0].get("cost_per_unit", 50)
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/purchase-orders", json=po_data, headers=auth_headers)
        assert response.status_code == 200, f"PO creation failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "po_number" in data
        assert data["supplier_name"] == po_data["supplier_name"]
        assert data["status"] == "ordered"
        assert "total_cost" in data
        
        print(f"✓ Created PO #{data['po_number']} for {data['supplier_name']}, total: ₹{data['total_cost']}")
        return data
    
    def test_list_purchase_orders(self, auth_headers):
        """List all purchase orders"""
        response = requests.get(f"{BASE_URL}/api/purchase-orders", headers=auth_headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Found {len(orders)} purchase orders")
        return orders
    
    def test_filter_purchase_orders_by_status(self, auth_headers):
        """Filter purchase orders by status"""
        response = requests.get(f"{BASE_URL}/api/purchase-orders?status=ordered", headers=auth_headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        for order in orders:
            assert order["status"] == "ordered"
        print(f"✓ Found {len(orders)} POs with status 'ordered'")
    
    def test_receive_purchase_order(self, auth_headers):
        """Mark a purchase order as received"""
        # Get existing POs with status 'ordered'
        po_res = requests.get(f"{BASE_URL}/api/purchase-orders?status=ordered", headers=auth_headers)
        orders = po_res.json()
        
        if not orders:
            # Create one first
            inv_res = requests.get(f"{BASE_URL}/api/inventory", headers=auth_headers)
            inventory = inv_res.json()
            if not inventory:
                pytest.skip("No inventory to test receive")
            
            po_data = {
                "supplier_name": f"TEST_Receive_{uuid.uuid4().hex[:6]}",
                "supplier_contact": "1234567890",
                "items": [{
                    "inventory_item_id": inventory[0]["id"],
                    "inventory_item_name": inventory[0]["name"],
                    "quantity": 5,
                    "unit": inventory[0].get("unit", "kg"),
                    "unit_cost": 30
                }]
            }
            create_res = requests.post(f"{BASE_URL}/api/purchase-orders", json=po_data, headers=auth_headers)
            orders = [create_res.json()]
        
        po_id = orders[0]["id"]
        
        # Mark as received
        response = requests.put(f"{BASE_URL}/api/purchase-orders/{po_id}/receive", headers=auth_headers)
        assert response.status_code == 200, f"Receive failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Marked PO as received, inventory updated")
    
    def test_cancel_purchase_order(self, auth_headers):
        """Cancel a purchase order"""
        # Create a new PO to cancel
        inv_res = requests.get(f"{BASE_URL}/api/inventory", headers=auth_headers)
        inventory = inv_res.json()
        if not inventory:
            pytest.skip("No inventory to create PO for cancellation")
        
        po_data = {
            "supplier_name": f"TEST_Cancel_{uuid.uuid4().hex[:6]}",
            "supplier_contact": "1111111111",
            "items": [{
                "inventory_item_id": inventory[0]["id"],
                "inventory_item_name": inventory[0]["name"],
                "quantity": 2,
                "unit": inventory[0].get("unit", "kg"),
                "unit_cost": 25
            }]
        }
        create_res = requests.post(f"{BASE_URL}/api/purchase-orders", json=po_data, headers=auth_headers)
        assert create_res.status_code == 200
        po_id = create_res.json()["id"]
        
        # Cancel it
        response = requests.put(f"{BASE_URL}/api/purchase-orders/{po_id}/cancel", headers=auth_headers)
        assert response.status_code == 200, f"Cancel failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        # Verify it's cancelled
        list_res = requests.get(f"{BASE_URL}/api/purchase-orders", headers=auth_headers)
        cancelled_po = next((p for p in list_res.json() if p["id"] == po_id), None)
        assert cancelled_po["status"] == "cancelled"
        print(f"✓ PO cancelled successfully")


class TestDayCloseReport:
    """Day Close Report API tests"""
    
    def test_get_current_session(self, auth_headers):
        """Get current day session"""
        response = requests.get(f"{BASE_URL}/api/day-session/current", headers=auth_headers)
        assert response.status_code == 200
        session = response.json()
        if session:
            print(f"✓ Day session open: {session['id']}")
        else:
            print("✓ Day session is closed")
        return session
    
    def test_get_session_history(self, auth_headers):
        """Get day session history"""
        response = requests.get(f"{BASE_URL}/api/day-session/history", headers=auth_headers)
        assert response.status_code == 200
        history = response.json()
        assert isinstance(history, list)
        print(f"✓ Found {len(history)} day sessions in history")
        return history
    
    def test_get_day_close_report(self, auth_headers):
        """Get day close report for a session"""
        # Get session history
        history_res = requests.get(f"{BASE_URL}/api/day-session/history", headers=auth_headers)
        history = history_res.json()
        
        # Get current session or use history
        current_res = requests.get(f"{BASE_URL}/api/day-session/current", headers=auth_headers)
        current = current_res.json()
        
        session_id = None
        if current:
            session_id = current["id"]
        elif history:
            session_id = history[0]["id"]
        
        if not session_id:
            pytest.skip("No day sessions to generate report")
        
        # Get report
        response = requests.get(f"{BASE_URL}/api/day-session/{session_id}/report", headers=auth_headers)
        assert response.status_code == 200, f"Report fetch failed: {response.text}"
        report = response.json()
        
        # Validate report structure
        assert "session" in report, "Report should have session info"
        assert "summary" in report, "Report should have summary"
        assert "payment_breakdown" in report, "Report should have payment breakdown"
        assert "order_type_breakdown" in report, "Report should have order type breakdown"
        assert "top_items" in report, "Report should have top items"
        assert "hourly_breakdown" in report, "Report should have hourly breakdown"
        assert "cash_summary" in report, "Report should have cash summary"
        
        # Validate summary fields
        summary = report["summary"]
        assert "total_orders" in summary
        assert "total_sales" in summary
        assert "total_tax" in summary
        assert "average_order_value" in summary
        
        # Validate cash summary
        cash = report["cash_summary"]
        assert "opening_cash" in cash
        assert "cash_sales" in cash
        assert "expected_cash" in cash
        
        print(f"✓ Day report: {summary['total_orders']} orders, ₹{summary['total_sales']:.2f} sales")
        print(f"  Payment breakdown: {report['payment_breakdown']}")
        print(f"  Order types: {report['order_type_breakdown']}")
        print(f"  Top items: {len(report['top_items'])}")
        print(f"  Hourly data: {len(report['hourly_breakdown'])} hours")
        return report


class TestDashboardOrderTypes:
    """Dashboard Order Types chart - via analytics"""
    
    def test_get_analytics(self, auth_headers):
        """Get analytics with order type breakdown"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "order_type_breakdown" in data, "Analytics should include order_type_breakdown"
        breakdown = data["order_type_breakdown"]
        assert isinstance(breakdown, dict)
        
        print(f"✓ Order type breakdown: {breakdown}")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
