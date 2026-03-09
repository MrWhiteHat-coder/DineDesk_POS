from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.staticfiles import StaticFiles
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'foodflow-pos-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="FoodFlow POS API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== PYDANTIC MODELS ==============

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    restaurant_id: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Restaurant Models
class RestaurantOnboarding(BaseModel):
    name: str
    restaurant_type: str  # restaurant, cafe, cloud_kitchen
    num_tables: int
    avg_daily_orders: int
    uses_delivery: bool
    delivery_platforms: List[str] = []  # swiggy, zomato
    contact_phone: str
    contact_email: EmailStr
    address: str
    city: str
    pincode: str

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    num_tables: Optional[int] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class RestaurantResponse(BaseModel):
    id: str
    name: str
    restaurant_type: str
    num_tables: int
    avg_daily_orders: int
    uses_delivery: bool
    delivery_platforms: List[str]
    contact_phone: str
    contact_email: str
    address: str
    city: str
    pincode: str
    is_active: bool
    subscription_status: str
    subscription_expires: Optional[str] = None
    created_at: str
    owner_id: str

# Subscription Models
class SubscriptionCreate(BaseModel):
    restaurant_id: str
    payment_method: str  # mock_razorpay
    
class SubscriptionResponse(BaseModel):
    id: str
    restaurant_id: str
    plan_name: str
    amount: float
    currency: str
    status: str
    payment_id: Optional[str] = None
    starts_at: str
    expires_at: str
    created_at: str

# Menu Models
class MenuCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0

class MenuCategoryResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool
    created_at: str

class MenuItemCreate(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_vegetarian: bool = False
    is_available: bool = True
    preparation_time: int = 15  # minutes

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_vegetarian: Optional[bool] = None
    is_available: Optional[bool] = None
    preparation_time: Optional[int] = None
    category_id: Optional[str] = None

class MenuItemResponse(BaseModel):
    id: str
    restaurant_id: str
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_vegetarian: bool
    is_available: bool
    preparation_time: int
    created_at: str

# Order Models
class OrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    order_type: str  # dine_in, takeaway, online
    table_number: Optional[int] = None
    items: List[OrderItemCreate]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: str  # cash, card, upi
    discount_amount: float = 0
    platform: Optional[str] = None  # swiggy, zomato

class OrderUpdate(BaseModel):
    status: str  # received, preparing, ready, completed, cancelled

class OrderResponse(BaseModel):
    id: str
    order_number: str
    restaurant_id: str
    order_type: str
    table_number: Optional[int] = None
    items: List[Dict[str, Any]]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    payment_method: str
    payment_status: str
    status: str
    platform: Optional[str] = None
    day_session_id: str
    created_at: str

# Day Session Models
class DaySessionResponse(BaseModel):
    id: str
    restaurant_id: str
    date: str
    status: str
    opened_at: str
    closed_at: Optional[str] = None
    opening_cash: float
    closing_cash: Optional[float] = None
    total_sales: float
    total_orders: int
    cash_sales: float
    card_sales: float
    upi_sales: float

# Inventory Models
class InventoryItemCreate(BaseModel):
    name: str
    unit: str  # kg, g, l, ml, pieces
    quantity: float
    min_quantity: float
    cost_per_unit: float

class InventoryItemUpdate(BaseModel):
    quantity: Optional[float] = None
    min_quantity: Optional[float] = None
    cost_per_unit: Optional[float] = None

class InventoryItemResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    unit: str
    quantity: float
    min_quantity: float
    cost_per_unit: float
    is_low_stock: bool
    created_at: str

# Staff Models
class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # manager, cashier

class StaffResponse(BaseModel):
    id: str
    restaurant_id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: str

# Table Models
class TableCreate(BaseModel):
    table_number: int
    capacity: int

class TableResponse(BaseModel):
    id: str
    restaurant_id: str
    table_number: int
    capacity: int
    status: str  # available, occupied, reserved
    current_order_id: Optional[str] = None

# Analytics Models
class AnalyticsResponse(BaseModel):
    daily_sales: float
    weekly_sales: float
    monthly_sales: float
    total_orders: int
    top_items: List[Dict[str, Any]]
    order_type_breakdown: Dict[str, int]
    hourly_orders: List[Dict[str, Any]]
    payment_breakdown: Dict[str, float]

# Admin Models
class AdminStats(BaseModel):
    total_restaurants: int
    active_restaurants: int
    total_users: int
    monthly_revenue: float
    daily_orders: int

class SystemLogResponse(BaseModel):
    id: str
    log_type: str
    user_id: Optional[str] = None
    restaurant_id: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str

# Webhook Models
class SwiggyWebhook(BaseModel):
    order_id: str
    restaurant_id: str
    items: List[Dict[str, Any]]
    customer: Dict[str, Any]
    delivery_address: str
    total_amount: float

class ZomatoWebhook(BaseModel):
    order_id: str
    restaurant_id: str
    items: List[Dict[str, Any]]
    customer: Dict[str, Any]
    delivery_address: str
    total_amount: float

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str, restaurant_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "restaurant_id": restaurant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def log_action(log_type: str, action: str, user_id: str = None, restaurant_id: str = None, details: str = None):
    log = {
        "id": str(uuid.uuid4()),
        "log_type": log_type,
        "user_id": user_id,
        "restaurant_id": restaurant_id,
        "action": action,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.system_logs.insert_one(log)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "owner",  # New users are restaurant owners
        "restaurant_id": None,
        "onboarding_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    await log_action("auth", "user_registered", user_id=user_id)
    
    token = create_token(user_id, "owner")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role="owner",
            restaurant_id=None,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"], user.get("restaurant_id"))
    await log_action("auth", "user_login", user_id=user["id"])
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            restaurant_id=user.get("restaurant_id"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        restaurant_id=user.get("restaurant_id"),
        created_at=user["created_at"]
    )

# ============== RESTAURANT ROUTES ==============

@api_router.post("/restaurants/onboard", response_model=RestaurantResponse)
async def onboard_restaurant(data: RestaurantOnboarding, user: dict = Depends(get_current_user)):
    restaurant_id = str(uuid.uuid4())
    restaurant = {
        "id": restaurant_id,
        "owner_id": user["id"],
        "name": data.name,
        "restaurant_type": data.restaurant_type,
        "num_tables": data.num_tables,
        "avg_daily_orders": data.avg_daily_orders,
        "uses_delivery": data.uses_delivery,
        "delivery_platforms": data.delivery_platforms,
        "contact_phone": data.contact_phone,
        "contact_email": data.contact_email,
        "address": data.address,
        "city": data.city,
        "pincode": data.pincode,
        "is_active": False,  # Needs subscription
        "subscription_status": "pending",
        "subscription_expires": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.restaurants.insert_one(restaurant)
    
    # Update user with restaurant_id
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"restaurant_id": restaurant_id, "onboarding_complete": True}}
    )
    
    # Create default tables
    for i in range(1, data.num_tables + 1):
        table = {
            "id": str(uuid.uuid4()),
            "restaurant_id": restaurant_id,
            "table_number": i,
            "capacity": 4,
            "status": "available",
            "current_order_id": None
        }
        await db.tables.insert_one(table)
    
    await log_action("restaurant", "restaurant_onboarded", user_id=user["id"], restaurant_id=restaurant_id)
    
    return RestaurantResponse(**{k: v for k, v in restaurant.items() if k != "_id"})

@api_router.get("/restaurants/my", response_model=RestaurantResponse)
async def get_my_restaurant(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=404, detail="No restaurant found")
    
    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return RestaurantResponse(**restaurant)

@api_router.put("/restaurants/my", response_model=RestaurantResponse)
async def update_my_restaurant(data: RestaurantUpdate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=404, detail="No restaurant found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.restaurants.update_one(
            {"id": user["restaurant_id"]},
            {"$set": update_data}
        )
    
    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    return RestaurantResponse(**restaurant)

# ============== SUBSCRIPTION ROUTES ==============

@api_router.post("/subscriptions/create", response_model=SubscriptionResponse)
async def create_subscription(data: SubscriptionCreate, user: dict = Depends(get_current_user)):
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Mock Razorpay payment
    payment_id = f"pay_mock_{uuid.uuid4().hex[:16]}"
    
    subscription_id = str(uuid.uuid4())
    starts_at = datetime.now(timezone.utc)
    expires_at = starts_at + timedelta(days=365)
    
    subscription = {
        "id": subscription_id,
        "restaurant_id": data.restaurant_id,
        "plan_name": "Restaurant POS Plan",
        "amount": 2999.0,
        "currency": "INR",
        "status": "active",
        "payment_id": payment_id,
        "payment_method": data.payment_method,
        "starts_at": starts_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "created_at": starts_at.isoformat()
    }
    await db.subscriptions.insert_one(subscription)
    
    # Activate restaurant
    await db.restaurants.update_one(
        {"id": data.restaurant_id},
        {"$set": {
            "is_active": True,
            "subscription_status": "active",
            "subscription_expires": expires_at.isoformat()
        }}
    )
    
    await log_action("subscription", "subscription_created", user_id=user["id"], restaurant_id=data.restaurant_id)
    
    return SubscriptionResponse(**{k: v for k, v in subscription.items() if k != "_id"})

@api_router.get("/subscriptions/my", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    subscriptions = await db.subscriptions.find(
        {"restaurant_id": user["restaurant_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [SubscriptionResponse(**s) for s in subscriptions]

# ============== MENU CATEGORY ROUTES ==============

@api_router.post("/menu/categories", response_model=MenuCategoryResponse)
async def create_category(data: MenuCategoryCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    category_id = str(uuid.uuid4())
    category = {
        "id": category_id,
        "restaurant_id": user["restaurant_id"],
        "name": data.name,
        "description": data.description,
        "sort_order": data.sort_order,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.menu_categories.insert_one(category)
    
    return MenuCategoryResponse(**{k: v for k, v in category.items() if k != "_id"})

@api_router.get("/menu/categories", response_model=List[MenuCategoryResponse])
async def get_categories(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    categories = await db.menu_categories.find(
        {"restaurant_id": user["restaurant_id"], "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    
    return [MenuCategoryResponse(**c) for c in categories]

@api_router.delete("/menu/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    result = await db.menu_categories.update_one(
        {"id": category_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ============== MENU ITEM ROUTES ==============

@api_router.post("/menu/items", response_model=MenuItemResponse)
async def create_menu_item(data: MenuItemCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "restaurant_id": user["restaurant_id"],
        "category_id": data.category_id,
        "name": data.name,
        "description": data.description,
        "price": data.price,
        "image_url": data.image_url,
        "is_vegetarian": data.is_vegetarian,
        "is_available": data.is_available,
        "preparation_time": data.preparation_time,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.menu_items.insert_one(item)
    
    return MenuItemResponse(**{k: v for k, v in item.items() if k != "_id"})

@api_router.get("/menu/items", response_model=List[MenuItemResponse])
async def get_menu_items(category_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    query = {"restaurant_id": user["restaurant_id"]}
    if category_id:
        query["category_id"] = category_id
    
    items = await db.menu_items.find(query, {"_id": 0}).to_list(500)
    return [MenuItemResponse(**i) for i in items]

@api_router.put("/menu/items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: str, data: MenuItemUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.menu_items.update_one(
            {"id": item_id, "restaurant_id": user.get("restaurant_id")},
            {"$set": update_data}
        )
    
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return MenuItemResponse(**item)

@api_router.delete("/menu/items/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.menu_items.delete_one(
        {"id": item_id, "restaurant_id": user.get("restaurant_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# ============== FILE UPLOAD ROUTE ==============

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_id = str(uuid.uuid4())
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_name = f"{file_id}.{file_ext}"
    file_path = UPLOAD_DIR / file_name
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/{file_name}"}

# ============== DAY SESSION ROUTES ==============

@api_router.post("/day-session/open", response_model=DaySessionResponse)
async def open_day(opening_cash: float = 0, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    # Check if there's already an open session
    existing = await db.day_sessions.find_one({
        "restaurant_id": user["restaurant_id"],
        "status": "open"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Day already open")
    
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session = {
        "id": session_id,
        "restaurant_id": user["restaurant_id"],
        "date": now.strftime("%Y-%m-%d"),
        "status": "open",
        "opened_at": now.isoformat(),
        "closed_at": None,
        "opening_cash": opening_cash,
        "closing_cash": None,
        "total_sales": 0,
        "total_orders": 0,
        "cash_sales": 0,
        "card_sales": 0,
        "upi_sales": 0,
        "opened_by": user["id"]
    }
    await db.day_sessions.insert_one(session)
    await log_action("day_session", "day_opened", user_id=user["id"], restaurant_id=user["restaurant_id"])
    
    return DaySessionResponse(**{k: v for k, v in session.items() if k not in ["_id", "opened_by"]})

@api_router.post("/day-session/close", response_model=DaySessionResponse)
async def close_day(closing_cash: float = 0, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    session = await db.day_sessions.find_one({
        "restaurant_id": user["restaurant_id"],
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=400, detail="No open day session")
    
    # Calculate totals
    orders = await db.orders.find({
        "day_session_id": session["id"],
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    total_sales = sum(o["total_amount"] for o in orders)
    cash_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "cash")
    card_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "card")
    upi_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "upi")
    
    now = datetime.now(timezone.utc)
    await db.day_sessions.update_one(
        {"id": session["id"]},
        {"$set": {
            "status": "closed",
            "closed_at": now.isoformat(),
            "closing_cash": closing_cash,
            "total_sales": total_sales,
            "total_orders": len(orders),
            "cash_sales": cash_sales,
            "card_sales": card_sales,
            "upi_sales": upi_sales
        }}
    )
    
    updated = await db.day_sessions.find_one({"id": session["id"]}, {"_id": 0})
    await log_action("day_session", "day_closed", user_id=user["id"], restaurant_id=user["restaurant_id"])
    
    return DaySessionResponse(**{k: v for k, v in updated.items() if k not in ["_id", "opened_by"]})

@api_router.get("/day-session/current", response_model=Optional[DaySessionResponse])
async def get_current_session(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return None
    
    session = await db.day_sessions.find_one({
        "restaurant_id": user["restaurant_id"],
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        return None
    
    return DaySessionResponse(**{k: v for k, v in session.items() if k not in ["_id", "opened_by"]})

@api_router.get("/day-session/history", response_model=List[DaySessionResponse])
async def get_session_history(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    sessions = await db.day_sessions.find(
        {"restaurant_id": user["restaurant_id"]},
        {"_id": 0, "opened_by": 0}
    ).sort("opened_at", -1).to_list(30)
    
    return [DaySessionResponse(**s) for s in sessions]

# ============== ORDER ROUTES ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    # Check day is open
    session = await db.day_sessions.find_one({
        "restaurant_id": user["restaurant_id"],
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=400, detail="Day not open. Please open the day first.")
    
    # Generate order number
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": user["restaurant_id"], "order_number": {"$regex": f"^{today}"}})
    order_number = f"{today}{count + 1:04d}"
    
    # Calculate totals
    order_items = []
    subtotal = 0
    
    for item_data in data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id}, {"_id": 0})
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item {item_data.menu_item_id} not found")
        
        item_total = menu_item["price"] * item_data.quantity
        subtotal += item_total
        
        order_items.append({
            "menu_item_id": item_data.menu_item_id,
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": item_data.quantity,
            "notes": item_data.notes,
            "total": item_total
        })
    
    tax_rate = 0.05  # 5% GST
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount - data.discount_amount, 2)
    
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": user["restaurant_id"],
        "order_type": data.order_type,
        "table_number": data.table_number,
        "items": order_items,
        "customer_name": data.customer_name,
        "customer_phone": data.customer_phone,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "discount_amount": data.discount_amount,
        "total_amount": total_amount,
        "payment_method": data.payment_method,
        "payment_status": "paid",
        "status": "received",
        "platform": data.platform,
        "day_session_id": session["id"],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    
    # Update table status if dine-in
    if data.order_type == "dine_in" and data.table_number:
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": data.table_number},
            {"$set": {"status": "occupied", "current_order_id": order_id}}
        )
    
    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "created_by"]})

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(status: Optional[str] = None, order_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    query = {"restaurant_id": user["restaurant_id"]}
    if status:
        query["status"] = status
    if order_type:
        query["order_type"] = order_type
    
    orders = await db.orders.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(100)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/today", response_model=List[OrderResponse])
async def get_today_orders(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    session = await db.day_sessions.find_one({
        "restaurant_id": user["restaurant_id"],
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        return []
    
    orders = await db.orders.find(
        {"day_session_id": session["id"]},
        {"_id": 0, "created_by": 0}
    ).sort("created_at", -1).to_list(500)
    
    return [OrderResponse(**o) for o in orders]

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, data: OrderUpdate, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one(
        {"id": order_id, "restaurant_id": user.get("restaurant_id")},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": data.status}}
    )
    
    # Free table if completed and dine-in
    if data.status == "completed" and order["order_type"] == "dine_in" and order.get("table_number"):
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": order["table_number"]},
            {"$set": {"status": "available", "current_order_id": None}}
        )
    
    order["status"] = data.status
    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "created_by"]})

# ============== INVENTORY ROUTES ==============

@api_router.post("/inventory", response_model=InventoryItemResponse)
async def create_inventory_item(data: InventoryItemCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "restaurant_id": user["restaurant_id"],
        "name": data.name,
        "unit": data.unit,
        "quantity": data.quantity,
        "min_quantity": data.min_quantity,
        "cost_per_unit": data.cost_per_unit,
        "is_low_stock": data.quantity <= data.min_quantity,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inventory.insert_one(item)
    
    return InventoryItemResponse(**{k: v for k, v in item.items() if k != "_id"})

@api_router.get("/inventory", response_model=List[InventoryItemResponse])
async def get_inventory(low_stock_only: bool = False, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    query = {"restaurant_id": user["restaurant_id"]}
    if low_stock_only:
        query["is_low_stock"] = True
    
    items = await db.inventory.find(query, {"_id": 0}).to_list(500)
    return [InventoryItemResponse(**i) for i in items]

@api_router.put("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(item_id: str, data: InventoryItemUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if update_data:
        # Recalculate low stock status
        item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
        if item:
            new_quantity = update_data.get("quantity", item["quantity"])
            new_min = update_data.get("min_quantity", item["min_quantity"])
            update_data["is_low_stock"] = new_quantity <= new_min
        
        await db.inventory.update_one(
            {"id": item_id, "restaurant_id": user.get("restaurant_id")},
            {"$set": update_data}
        )
    
    item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse(**item)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.inventory.delete_one(
        {"id": item_id, "restaurant_id": user.get("restaurant_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# ============== TABLE ROUTES ==============

@api_router.get("/tables", response_model=List[TableResponse])
async def get_tables(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    tables = await db.tables.find(
        {"restaurant_id": user["restaurant_id"]},
        {"_id": 0}
    ).sort("table_number", 1).to_list(100)
    
    return [TableResponse(**t) for t in tables]

@api_router.post("/tables", response_model=TableResponse)
async def create_table(data: TableCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    table_id = str(uuid.uuid4())
    table = {
        "id": table_id,
        "restaurant_id": user["restaurant_id"],
        "table_number": data.table_number,
        "capacity": data.capacity,
        "status": "available",
        "current_order_id": None
    }
    await db.tables.insert_one(table)
    
    return TableResponse(**{k: v for k, v in table.items() if k != "_id"})

@api_router.put("/tables/{table_id}/status")
async def update_table_status(table_id: str, status: str, user: dict = Depends(get_current_user)):
    await db.tables.update_one(
        {"id": table_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"status": status}}
    )
    return {"message": "Table status updated"}

# ============== STAFF ROUTES ==============

@api_router.post("/staff", response_model=StaffResponse)
async def create_staff(data: StaffCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners can create staff")
    
    # Check if email exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    staff_id = str(uuid.uuid4())
    staff = {
        "id": staff_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "restaurant_id": user["restaurant_id"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(staff)
    
    return StaffResponse(**{k: v for k, v in staff.items() if k not in ["_id", "password"]})

@api_router.get("/staff", response_model=List[StaffResponse])
async def get_staff(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    
    staff = await db.users.find(
        {"restaurant_id": user["restaurant_id"], "role": {"$in": ["manager", "cashier"]}},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    return [StaffResponse(**s) for s in staff]

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners can delete staff")
    
    result = await db.users.update_one(
        {"id": staff_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"message": "Staff deleted"}

# ============== ANALYTICS ROUTES ==============

@api_router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    # Get orders for different periods
    all_orders = await db.orders.find(
        {"restaurant_id": user["restaurant_id"], "status": "completed"},
        {"_id": 0}
    ).to_list(10000)
    
    daily_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= today_start.isoformat())
    weekly_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= week_start.isoformat())
    monthly_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= month_start.isoformat())
    
    # Top items
    item_counts = {}
    for order in all_orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + item.get("quantity", 1)
    
    top_items = sorted([{"name": k, "count": v} for k, v in item_counts.items()], key=lambda x: -x["count"])[:10]
    
    # Order type breakdown
    order_types = {}
    for order in all_orders:
        ot = order.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1
    
    # Hourly distribution
    hourly = {}
    for order in all_orders:
        try:
            hour = datetime.fromisoformat(order["created_at"]).hour
            hourly[hour] = hourly.get(hour, 0) + 1
        except:
            pass
    hourly_orders = [{"hour": h, "orders": c} for h, c in sorted(hourly.items())]
    
    # Payment breakdown
    payment_breakdown = {}
    for order in all_orders:
        pm = order.get("payment_method", "unknown")
        payment_breakdown[pm] = payment_breakdown.get(pm, 0) + order["total_amount"]
    
    return AnalyticsResponse(
        daily_sales=daily_sales,
        weekly_sales=weekly_sales,
        monthly_sales=monthly_sales,
        total_orders=len(all_orders),
        top_items=top_items,
        order_type_breakdown=order_types,
        hourly_orders=hourly_orders,
        payment_breakdown=payment_breakdown
    )

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    total_restaurants = await db.restaurants.count_documents({})
    active_restaurants = await db.restaurants.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    
    # Monthly revenue from subscriptions
    month_start = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    subscriptions = await db.subscriptions.find(
        {"created_at": {"$gte": month_start}},
        {"_id": 0}
    ).to_list(1000)
    monthly_revenue = sum(s["amount"] for s in subscriptions)
    
    # Daily orders across all restaurants
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    daily_orders = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    
    return AdminStats(
        total_restaurants=total_restaurants,
        active_restaurants=active_restaurants,
        total_users=total_users,
        monthly_revenue=monthly_revenue,
        daily_orders=daily_orders
    )

@api_router.get("/admin/restaurants")
async def get_all_restaurants(search: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    restaurants = await db.restaurants.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return restaurants

@api_router.put("/admin/restaurants/{restaurant_id}/status")
async def update_restaurant_status(restaurant_id: str, is_active: bool, user: dict = Depends(get_admin_user)):
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_active": is_active}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    await log_action("admin", f"restaurant_{'activated' if is_active else 'suspended'}", user_id=user["id"], restaurant_id=restaurant_id)
    return {"message": f"Restaurant {'activated' if is_active else 'suspended'}"}

@api_router.get("/admin/subscriptions")
async def get_all_subscriptions(user: dict = Depends(get_admin_user)):
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return subscriptions

@api_router.get("/admin/users")
async def get_all_users(user: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.get("/admin/logs", response_model=List[SystemLogResponse])
async def get_system_logs(log_type: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {}
    if log_type:
        query["log_type"] = log_type
    
    logs = await db.system_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [SystemLogResponse(**l) for l in logs]

@api_router.get("/admin/analytics")
async def get_platform_analytics(user: dict = Depends(get_admin_user)):
    # Orders per day for last 30 days
    orders = await db.orders.find({}, {"_id": 0, "created_at": 1, "total_amount": 1}).to_list(10000)
    
    daily_orders = {}
    daily_revenue = {}
    for order in orders:
        try:
            date = order["created_at"][:10]
            daily_orders[date] = daily_orders.get(date, 0) + 1
            daily_revenue[date] = daily_revenue.get(date, 0) + order.get("total_amount", 0)
        except:
            pass
    
    return {
        "orders_by_day": [{"date": k, "orders": v} for k, v in sorted(daily_orders.items())[-30:]],
        "revenue_by_day": [{"date": k, "revenue": v} for k, v in sorted(daily_revenue.items())[-30:]]
    }

# ============== WEBHOOK ROUTES (Mock for Swiggy/Zomato) ==============

@api_router.post("/webhooks/swiggy")
async def swiggy_webhook(data: SwiggyWebhook):
    """Webhook endpoint for Swiggy orders (Mock)"""
    # In production, verify webhook signature
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check day session
    session = await db.day_sessions.find_one({
        "restaurant_id": data.restaurant_id,
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=400, detail="Restaurant day not open")
    
    # Create order
    order_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": data.restaurant_id, "order_number": {"$regex": f"^{today}"}})
    order_number = f"{today}{count + 1:04d}"
    
    order = {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": data.restaurant_id,
        "order_type": "online",
        "items": data.items,
        "customer_name": data.customer.get("name"),
        "customer_phone": data.customer.get("phone"),
        "subtotal": data.total_amount,
        "tax_amount": 0,
        "discount_amount": 0,
        "total_amount": data.total_amount,
        "payment_method": "online",
        "payment_status": "paid",
        "status": "received",
        "platform": "swiggy",
        "external_order_id": data.order_id,
        "delivery_address": data.delivery_address,
        "day_session_id": session["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    
    return {"message": "Order received", "order_id": order_id}

@api_router.post("/webhooks/zomato")
async def zomato_webhook(data: ZomatoWebhook):
    """Webhook endpoint for Zomato orders (Mock)"""
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    session = await db.day_sessions.find_one({
        "restaurant_id": data.restaurant_id,
        "status": "open"
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=400, detail="Restaurant day not open")
    
    order_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": data.restaurant_id, "order_number": {"$regex": f"^{today}"}})
    order_number = f"{today}{count + 1:04d}"
    
    order = {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": data.restaurant_id,
        "order_type": "online",
        "items": data.items,
        "customer_name": data.customer.get("name"),
        "customer_phone": data.customer.get("phone"),
        "subtotal": data.total_amount,
        "tax_amount": 0,
        "discount_amount": 0,
        "total_amount": data.total_amount,
        "payment_method": "online",
        "payment_status": "paid",
        "status": "received",
        "platform": "zomato",
        "external_order_id": data.order_id,
        "delivery_address": data.delivery_address,
        "day_session_id": session["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    
    return {"message": "Order received", "order_id": order_id}

# ============== UTILITY ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "FoodFlow POS API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

# Mount uploads directory
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create admin user if not exists
    admin = await db.users.find_one({"email": "admin@foodflow.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@foodflow.com",
            "password": hash_password("admin123"),
            "name": "Platform Admin",
            "role": "admin",
            "restaurant_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Admin user created: admin@foodflow.com / admin123")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.restaurants.create_index("owner_id")
    await db.orders.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.menu_items.create_index([("restaurant_id", 1), ("category_id", 1)])
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
