#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FoodFlowAPITester:
    def __init__(self, base_url="https://dinepos-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.restaurant_id = None
        self.subscription_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, response=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }
        
        if response:
            result["status_code"] = response.status_code
            result["response_time_ms"] = response.elapsed.total_seconds() * 1000
        if error:
            result["error"] = str(error)
            
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if error:
            print(f"    Error: {error}")
        elif response:
            print(f"    Status: {response.status_code} | Time: {response.elapsed.total_seconds() * 1000:.0f}ms")

    def make_request(self, method, endpoint, data=None, token=None, params=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")

    def test_health_check(self):
        """Test basic health endpoints"""
        try:
            # Test root endpoint
            response = self.make_request('GET', '')
            success = response.status_code == 200
            self.log_result("Health Check - Root", success, response)
            
            # Test health endpoint
            response = self.make_request('GET', 'health')
            success = response.status_code == 200
            self.log_result("Health Check - Health Endpoint", success, response)
            
        except Exception as e:
            self.log_result("Health Check", False, error=e)

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        try:
            data = {
                "email": "admin@foodflow.com",
                "password": "admin123"
            }
            response = self.make_request('POST', 'auth/login', data)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                self.admin_token = response_data.get('access_token')
                user = response_data.get('user', {})
                success = user.get('role') == 'admin' and self.admin_token is not None
                
            self.log_result("Admin Login", success, response)
            return success
            
        except Exception as e:
            self.log_result("Admin Login", False, error=e)
            return False

    def test_user_registration(self):
        """Test new user registration"""
        try:
            timestamp = datetime.now().strftime("%H%M%S")
            data = {
                "email": f"test{timestamp}@example.com",
                "password": "password123",
                "name": "Test User"
            }
            response = self.make_request('POST', 'auth/register', data)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                self.user_token = response_data.get('access_token')
                user = response_data.get('user', {})
                success = user.get('role') == 'owner' and self.user_token is not None
                
            self.log_result("User Registration", success, response)
            return success
            
        except Exception as e:
            self.log_result("User Registration", False, error=e)
            return False

    def test_restaurant_onboarding(self):
        """Test restaurant onboarding process"""
        if not self.user_token:
            self.log_result("Restaurant Onboarding", False, error="No user token available")
            return False
            
        try:
            data = {
                "name": "Test Restaurant",
                "restaurant_type": "restaurant",
                "num_tables": 10,
                "avg_daily_orders": 50,
                "uses_delivery": True,
                "delivery_platforms": ["swiggy", "zomato"],
                "contact_phone": "+91 9876543210",
                "contact_email": "restaurant@test.com",
                "address": "123 Test Street",
                "city": "Mumbai",
                "pincode": "400001"
            }
            response = self.make_request('POST', 'restaurants/onboard', data, self.user_token)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                self.restaurant_id = response_data.get('id')
                success = self.restaurant_id is not None
                
            self.log_result("Restaurant Onboarding", success, response)
            return success
            
        except Exception as e:
            self.log_result("Restaurant Onboarding", False, error=e)
            return False

    def test_subscription_creation(self):
        """Test subscription creation with mock payment"""
        if not self.user_token or not self.restaurant_id:
            self.log_result("Subscription Creation", False, error="No user token or restaurant ID")
            return False
            
        try:
            data = {
                "restaurant_id": self.restaurant_id,
                "payment_method": "mock_razorpay"
            }
            response = self.make_request('POST', 'subscriptions/create', data, self.user_token)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                self.subscription_id = response_data.get('id')
                success = (self.subscription_id is not None and 
                          response_data.get('status') == 'active' and
                          response_data.get('amount') == 2999.0)
                
            self.log_result("Subscription Creation", success, response)
            return success
            
        except Exception as e:
            self.log_result("Subscription Creation", False, error=e)
            return False

    def test_day_session_management(self):
        """Test day open/close functionality"""
        if not self.user_token:
            self.log_result("Day Session Management", False, error="No user token")
            return False
            
        try:
            # Open day
            response = self.make_request('POST', 'day-session/open', params={'opening_cash': 1000}, token=self.user_token)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                session_id = response_data.get('id')
                success = session_id is not None and response_data.get('status') == 'open'
            
            self.log_result("Day Session - Open", success, response)
            
            if success:
                # Get current session
                response = self.make_request('GET', 'day-session/current', token=self.user_token)
                success = response.status_code == 200 and response.json() is not None
                self.log_result("Day Session - Get Current", success, response)
                
                # Close day
                response = self.make_request('POST', 'day-session/close', params={'closing_cash': 1200}, token=self.user_token)
                success = response.status_code == 200
                if success:
                    response_data = response.json()
                    success = response_data.get('status') == 'closed'
                self.log_result("Day Session - Close", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Day Session Management", False, error=e)
            return False

    def test_menu_management(self):
        """Test menu category and item management"""
        if not self.user_token:
            self.log_result("Menu Management", False, error="No user token")
            return False
            
        try:
            # Create category
            category_data = {
                "name": "Test Category",
                "description": "Test category for automated testing",
                "sort_order": 0
            }
            response = self.make_request('POST', 'menu/categories', category_data, self.user_token)
            success = response.status_code == 200
            category_id = None
            
            if success:
                category_id = response.json().get('id')
                success = category_id is not None
            
            self.log_result("Menu - Create Category", success, response)
            
            if success and category_id:
                # Create menu item
                item_data = {
                    "category_id": category_id,
                    "name": "Test Item",
                    "description": "A test menu item",
                    "price": 299.99,
                    "is_vegetarian": True,
                    "is_available": True,
                    "preparation_time": 15
                }
                response = self.make_request('POST', 'menu/items', item_data, self.user_token)
                success = response.status_code == 200
                item_id = None
                
                if success:
                    item_id = response.json().get('id')
                    success = item_id is not None
                
                self.log_result("Menu - Create Item", success, response)
                
                # Get menu items
                response = self.make_request('GET', 'menu/items', token=self.user_token)
                success = response.status_code == 200
                if success:
                    items = response.json()
                    success = len(items) > 0
                self.log_result("Menu - Get Items", success, response)
                
                # Get categories
                response = self.make_request('GET', 'menu/categories', token=self.user_token)
                success = response.status_code == 200
                if success:
                    categories = response.json()
                    success = len(categories) > 0
                self.log_result("Menu - Get Categories", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Menu Management", False, error=e)
            return False

    def test_order_management(self):
        """Test order creation and management"""
        if not self.user_token:
            self.log_result("Order Management", False, error="No user token")
            return False
        
        try:
            # First open a day session for orders
            response = self.make_request('POST', 'day-session/open', params={'opening_cash': 1000}, token=self.user_token)
            if response.status_code != 200:
                self.log_result("Order Management - Day Session", False, response)
                return False
            
            # Get menu items to create an order
            response = self.make_request('GET', 'menu/items', token=self.user_token)
            if response.status_code != 200 or not response.json():
                self.log_result("Order Management - Get Menu", False, error="No menu items available")
                return False
            
            menu_items = response.json()
            if not menu_items:
                self.log_result("Order Management", False, error="No menu items found for order")
                return False
            
            # Create order
            order_data = {
                "order_type": "dine_in",
                "table_number": 5,
                "items": [
                    {
                        "menu_item_id": menu_items[0]['id'],
                        "quantity": 2,
                        "notes": "Extra spicy"
                    }
                ],
                "customer_name": "Test Customer",
                "customer_phone": "+91 9876543210",
                "payment_method": "cash",
                "discount_amount": 0
            }
            
            response = self.make_request('POST', 'orders', order_data, self.user_token)
            success = response.status_code == 200
            order_id = None
            
            if success:
                order_data_response = response.json()
                order_id = order_data_response.get('id')
                success = order_id is not None and order_data_response.get('status') == 'received'
            
            self.log_result("Order Management - Create Order", success, response)
            
            if success and order_id:
                # Update order status
                status_data = {"status": "preparing"}
                response = self.make_request('PUT', f'orders/{order_id}/status', status_data, self.user_token)
                success = response.status_code == 200
                self.log_result("Order Management - Update Status", success, response)
                
                # Get today's orders
                response = self.make_request('GET', 'orders/today', token=self.user_token)
                success = response.status_code == 200
                if success:
                    orders = response.json()
                    success = len(orders) > 0
                self.log_result("Order Management - Get Today Orders", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Order Management", False, error=e)
            return False

    def test_inventory_management(self):
        """Test inventory management"""
        if not self.user_token:
            self.log_result("Inventory Management", False, error="No user token")
            return False
            
        try:
            # Create inventory item
            item_data = {
                "name": "Test Ingredient",
                "unit": "kg",
                "quantity": 10.5,
                "min_quantity": 2.0,
                "cost_per_unit": 50.0
            }
            response = self.make_request('POST', 'inventory', item_data, self.user_token)
            success = response.status_code == 200
            item_id = None
            
            if success:
                item_id = response.json().get('id')
                success = item_id is not None
            
            self.log_result("Inventory - Create Item", success, response)
            
            if success:
                # Get inventory
                response = self.make_request('GET', 'inventory', token=self.user_token)
                success = response.status_code == 200
                if success:
                    items = response.json()
                    success = len(items) > 0
                self.log_result("Inventory - Get Items", success, response)
                
                # Update inventory
                update_data = {"quantity": 8.0}
                response = self.make_request('PUT', f'inventory/{item_id}', update_data, self.user_token)
                success = response.status_code == 200
                self.log_result("Inventory - Update Item", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Inventory Management", False, error=e)
            return False

    def test_staff_management(self):
        """Test staff management"""
        if not self.user_token:
            self.log_result("Staff Management", False, error="No user token")
            return False
            
        try:
            timestamp = datetime.now().strftime("%H%M%S")
            # Create staff member
            staff_data = {
                "email": f"staff{timestamp}@test.com",
                "password": "staff123",
                "name": "Test Staff",
                "role": "cashier"
            }
            response = self.make_request('POST', 'staff', staff_data, self.user_token)
            success = response.status_code == 200
            staff_id = None
            
            if success:
                staff_id = response.json().get('id')
                success = staff_id is not None
            
            self.log_result("Staff Management - Create Staff", success, response)
            
            if success:
                # Get staff list
                response = self.make_request('GET', 'staff', token=self.user_token)
                success = response.status_code == 200
                if success:
                    staff = response.json()
                    success = len(staff) > 0
                self.log_result("Staff Management - Get Staff", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Staff Management", False, error=e)
            return False

    def test_analytics(self):
        """Test analytics endpoints"""
        if not self.user_token:
            self.log_result("Analytics", False, error="No user token")
            return False
            
        try:
            response = self.make_request('GET', 'analytics', token=self.user_token)
            success = response.status_code == 200
            
            if success:
                analytics_data = response.json()
                required_fields = ['daily_sales', 'weekly_sales', 'monthly_sales', 'total_orders', 'top_items']
                success = all(field in analytics_data for field in required_fields)
            
            self.log_result("Analytics", success, response)
            return success
            
        except Exception as e:
            self.log_result("Analytics", False, error=e)
            return False

    def test_admin_functionality(self):
        """Test admin-specific endpoints"""
        if not self.admin_token:
            self.log_result("Admin Functionality", False, error="No admin token")
            return False
            
        try:
            # Get admin stats
            response = self.make_request('GET', 'admin/stats', token=self.admin_token)
            success = response.status_code == 200
            
            if success:
                stats = response.json()
                required_fields = ['total_restaurants', 'active_restaurants', 'total_users', 'monthly_revenue']
                success = all(field in stats for field in required_fields)
            
            self.log_result("Admin - Get Stats", success, response)
            
            if success:
                # Get all restaurants
                response = self.make_request('GET', 'admin/restaurants', token=self.admin_token)
                success = response.status_code == 200
                self.log_result("Admin - Get Restaurants", success, response)
                
                # Get all users
                response = self.make_request('GET', 'admin/users', token=self.admin_token)
                success = response.status_code == 200
                self.log_result("Admin - Get Users", success, response)
                
                # Get system logs
                response = self.make_request('GET', 'admin/logs', token=self.admin_token)
                success = response.status_code == 200
                self.log_result("Admin - Get Logs", success, response)
            
            return success
            
        except Exception as e:
            self.log_result("Admin Functionality", False, error=e)
            return False

    def test_tables_management(self):
        """Test tables management"""
        if not self.user_token:
            self.log_result("Tables Management", False, error="No user token")
            return False
            
        try:
            # Get tables (should be created during onboarding)
            response = self.make_request('GET', 'tables', token=self.user_token)
            success = response.status_code == 200
            
            if success:
                tables = response.json()
                success = len(tables) > 0  # Should have tables from onboarding
            
            self.log_result("Tables Management", success, response)
            return success
            
        except Exception as e:
            self.log_result("Tables Management", False, error=e)
            return False

def main():
    print("🚀 Starting FoodFlow POS API Testing")
    print("=" * 50)
    
    tester = FoodFlowAPITester()
    
    # Run test suite
    print("\n📡 Testing Basic Connectivity...")
    tester.test_health_check()
    
    print("\n🔐 Testing Authentication...")
    admin_login_success = tester.test_admin_login()
    user_reg_success = tester.test_user_registration()
    
    if user_reg_success:
        print("\n🏪 Testing Restaurant Onboarding...")
        onboard_success = tester.test_restaurant_onboarding()
        
        if onboard_success:
            print("\n💳 Testing Subscription...")
            subscription_success = tester.test_subscription_creation()
            
            if subscription_success:
                print("\n📅 Testing Day Session Management...")
                tester.test_day_session_management()
                
                print("\n🍽️ Testing Menu Management...")
                menu_success = tester.test_menu_management()
                
                if menu_success:
                    print("\n📋 Testing Order Management...")
                    tester.test_order_management()
                
                print("\n📦 Testing Inventory Management...")
                tester.test_inventory_management()
                
                print("\n👥 Testing Staff Management...")
                tester.test_staff_management()
                
                print("\n📊 Testing Analytics...")
                tester.test_analytics()
                
                print("\n🏢 Testing Tables Management...")
                tester.test_tables_management()
    
    if admin_login_success:
        print("\n👨‍💼 Testing Admin Functionality...")
        tester.test_admin_functionality()
    
    # Print results summary
    print("\n" + "=" * 50)
    print("🎯 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("🎉 Excellent! API is working great!")
        exit_code = 0
    elif success_rate >= 70:
        print("⚠️  Good, but some issues need attention")
        exit_code = 1
    else:
        print("❌ Critical issues found - needs immediate attention")
        exit_code = 2
    
    # Save detailed results
    results_file = "/app/test_reports/backend_api_results.json"
    try:
        import os
        os.makedirs(os.path.dirname(results_file), exist_ok=True)
        with open(results_file, 'w') as f:
            json.dump({
                "summary": {
                    "tests_run": tester.tests_run,
                    "tests_passed": tester.tests_passed,
                    "success_rate": success_rate,
                    "timestamp": datetime.now().isoformat()
                },
                "detailed_results": tester.test_results
            }, f, indent=2)
        print(f"\n📄 Detailed results saved to: {results_file}")
    except Exception as e:
        print(f"⚠️  Could not save results file: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())