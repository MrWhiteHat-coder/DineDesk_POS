"""
Test Iteration 9: Notifications and Analytics features
- Notifications page: SMS/WhatsApp settings, send test, view logs
- Analytics: Branch selector filtering
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - loaded from environment
TEST_EMAIL = os.environ.get('TEST_EMAIL', 'demo@restaurant.com')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', 'demo123456')


class TestAuth:
    """Authentication fixture tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestNotificationSettings(TestAuth):
    """Test notification settings endpoints"""
    
    def test_get_notification_settings(self, auth_headers):
        """GET /api/notifications/settings returns sms_enabled and whatsapp_enabled"""
        response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Check structure has sms_enabled and whatsapp_enabled
        assert "sms_enabled" in data, "Response should contain sms_enabled"
        assert "whatsapp_enabled" in data, "Response should contain whatsapp_enabled"
        assert isinstance(data["sms_enabled"], bool)
        assert isinstance(data["whatsapp_enabled"], bool)
        print(f"Notification settings: SMS={data['sms_enabled']}, WhatsApp={data['whatsapp_enabled']}")
    
    def test_update_notification_settings_sms_off(self, auth_headers):
        """PUT /api/notifications/settings can turn off SMS"""
        response = requests.put(f"{BASE_URL}/api/notifications/settings", 
                               json={"sms_enabled": False, "whatsapp_enabled": True},
                               headers=auth_headers)
        assert response.status_code == 200
        
        # Verify the change was saved
        verify_response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=auth_headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["sms_enabled"] == False, "SMS should be disabled"
        assert data["whatsapp_enabled"] == True, "WhatsApp should remain enabled"
    
    def test_update_notification_settings_whatsapp_off(self, auth_headers):
        """PUT /api/notifications/settings can turn off WhatsApp"""
        response = requests.put(f"{BASE_URL}/api/notifications/settings", 
                               json={"sms_enabled": True, "whatsapp_enabled": False},
                               headers=auth_headers)
        assert response.status_code == 200
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=auth_headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["sms_enabled"] == True
        assert data["whatsapp_enabled"] == False
    
    def test_update_notification_settings_both_on(self, auth_headers):
        """PUT /api/notifications/settings - restore both to enabled"""
        response = requests.put(f"{BASE_URL}/api/notifications/settings", 
                               json={"sms_enabled": True, "whatsapp_enabled": True},
                               headers=auth_headers)
        assert response.status_code == 200
        
        # Verify restoration
        verify_response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=auth_headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["sms_enabled"] == True
        assert data["whatsapp_enabled"] == True


class TestNotificationLogs(TestAuth):
    """Test notification logs endpoints"""
    
    def test_get_notifications(self, auth_headers):
        """GET /api/notifications returns list of notification logs"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} notification logs")
        
        # If there are notifications, check structure
        if len(data) > 0:
            notif = data[0]
            # Check required fields exist
            assert "id" in notif, "Notification should have id"
            assert "status" in notif, "Notification should have status"
            assert "created_at" in notif, "Notification should have created_at"
            print(f"Latest notification: order={notif.get('order_number')}, status={notif.get('status')}")
    
    def test_send_test_notification(self, auth_headers):
        """POST /api/notifications/test sends a test notification and creates log"""
        response = requests.post(f"{BASE_URL}/api/notifications/test", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Test notification response: {data['message']}")
        
        # Wait and verify a log was created
        import time
        time.sleep(2)  # Give time for async notification to complete
        
        logs_response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert logs_response.status_code == 200
        logs = logs_response.json()
        
        # Find the test notification log
        test_logs = [l for l in logs if l.get("order_number") == "TEST-001"]
        assert len(test_logs) > 0, "Test notification should create a log entry"
        
        latest_test = test_logs[0]
        print(f"Test notification log: status={latest_test.get('status')}, error={latest_test.get('error', 'None')}")
        # Status can be 'sent', 'failed', or 'skipped' - all are valid as long as it was logged
        assert latest_test["status"] in ["sent", "failed", "skipped"], "Status should be valid"


class TestAnalyticsBranchFilter(TestAuth):
    """Test analytics branch filtering"""
    
    def test_get_branches_list(self, auth_headers):
        """GET /api/branches returns list of branches"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200
        branches = response.json()
        assert isinstance(branches, list)
        print(f"Found {len(branches)} branches")
        return branches
    
    def test_analytics_without_branch_filter(self, auth_headers):
        """GET /api/analytics without branch_id returns all orders"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/analytics", 
                               params={"date": today},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "daily_sales" in data
        assert "total_orders" in data
        assert "order_type_breakdown" in data
        assert "selected_date" in data
        print(f"Analytics (all branches): orders={data['total_orders']}, sales={data['daily_sales']}")
    
    def test_analytics_with_all_branches(self, auth_headers):
        """GET /api/analytics?branch_id=all returns same as no filter"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/analytics", 
                               params={"date": today, "branch_id": "all"},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "daily_sales" in data
        assert "total_orders" in data
        print(f"Analytics (branch=all): orders={data['total_orders']}, sales={data['daily_sales']}")
    
    def test_analytics_with_specific_branch(self, auth_headers):
        """GET /api/analytics?branch_id=xxx filters by branch"""
        # First get branches
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_response.json()
        
        if len(branches) == 0:
            pytest.skip("No branches to test with")
        
        branch_id = branches[0]["id"]
        branch_name = branches[0]["name"]
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/analytics", 
                               params={"date": today, "branch_id": branch_id},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_sales" in data
        assert "total_orders" in data
        print(f"Analytics for branch '{branch_name}': orders={data['total_orders']}, sales={data['daily_sales']}")
    
    def test_analytics_date_and_branch_combined(self, auth_headers):
        """GET /api/analytics with both date and branch_id parameters"""
        # Get branches first
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_response.json()
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        params = {"date": yesterday}
        if len(branches) > 0:
            params["branch_id"] = branches[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/analytics", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["selected_date"] == yesterday
        print(f"Analytics for {yesterday} (filtered): orders={data['total_orders']}")


class TestNotificationOnOrderComplete(TestAuth):
    """Test that notifications are logged after order completion"""
    
    def test_notification_log_has_order_info(self, auth_headers):
        """Notification logs should have order_number, customer_name, customer_phone"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        logs = response.json()
        
        if len(logs) == 0:
            print("No notification logs yet - this is expected if no orders have been completed")
            return
        
        # Check structure of a log entry
        log = logs[0]
        expected_fields = ["id", "order_number", "customer_name", "customer_phone", "message", "status", "created_at"]
        for field in expected_fields:
            assert field in log, f"Notification log should have {field}"
        
        print(f"Notification log structure valid: order={log['order_number']}, customer={log['customer_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
