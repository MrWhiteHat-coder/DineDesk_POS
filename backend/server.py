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

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

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
    branch_id: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Restaurant Models
class RestaurantOnboarding(BaseModel):
    name: str
    restaurant_type: str
    num_tables: int
    avg_daily_orders: int
    uses_delivery: bool
    delivery_platforms: List[str] = []
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

# Branch Models
class BranchCreate(BaseModel):
    name: str
    address: str
    city: str
    pincode: str
    contact_phone: str
    share_menu: bool = True

class BranchResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    address: str
    city: str
    pincode: str
    contact_phone: str
    share_menu: bool
    is_active: bool
    created_at: str

# Subscription Models
class SubscriptionCreate(BaseModel):
    restaurant_id: str
    payment_method: str

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

class RecipeIngredient(BaseModel):
    inventory_item_id: str
    inventory_item_name: Optional[str] = None
    quantity_needed: float
    unit: str

class MenuItemCreate(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_vegetarian: bool = False
    is_available: bool = True
    preparation_time: int = 15
    recipe: List[RecipeIngredient] = []

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_vegetarian: Optional[bool] = None
    is_available: Optional[bool] = None
    preparation_time: Optional[int] = None
    category_id: Optional[str] = None
    recipe: Optional[List[RecipeIngredient]] = None

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
    recipe: List[Dict[str, Any]] = []
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
    customer_email: Optional[str] = None
    payment_method: str = "pending"  # cash, card, upi, pending
    discount_amount: float = 0
    platform: Optional[str] = None

class OrderAddItems(BaseModel):
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: str  # received, preparing, ready, served, completed, cancelled

class OrderPayment(BaseModel):
    payment_method: str  # cash, card, upi

class OrderResponse(BaseModel):
    id: str
    order_number: str
    restaurant_id: str
    order_type: str
    table_number: Optional[int] = None
    items: List[Dict[str, Any]]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
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
    unit: str
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
    role: str  # manager, cashier, captain, chef

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
    status: str
    current_order_id: Optional[str] = None

# Wallet Models
class WalletTransactionCreate(BaseModel):
    transaction_type: str  # sale, refund, adjustment
    amount: float
    payment_method: str  # cash, card, upi
    reference_id: Optional[str] = None
    notes: Optional[str] = None

class WalletSummaryResponse(BaseModel):
    total_cash: float
    total_card: float
    total_upi: float
    total_sales: float
    total_refunds: float
    net_amount: float
    transactions: List[Dict[str, Any]]

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

# Role-based access helpers
ROLE_ACCESS = {
    "owner": {"dashboard", "menu_order", "analytics", "kds", "tables", "menu", "inventory", "staff", "settings", "online_orders", "wallet", "branches", "purchase_orders"},
    "manager": {"dashboard", "menu_order", "analytics", "kds", "tables", "menu", "inventory", "staff", "settings", "online_orders", "wallet", "branches", "purchase_orders"},
    "cashier": {"dashboard", "menu_order", "wallet", "analytics"},
    "captain": {"menu_order", "tables", "kds"},
    "chef": {"kds"},
}

def check_role(user: dict, feature: str):
    role = user.get("role", "")
    if role == "admin":
        return
    allowed = ROLE_ACCESS.get(role, set())
    if feature not in allowed:
        raise HTTPException(status_code=403, detail=f"Access denied. Your role '{role}' cannot access '{feature}'")

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

async def deduct_inventory(restaurant_id: str, order_items_data: list):
    """Deduct inventory based on recipe for each ordered item."""
    for item_data in order_items_data:
        menu_item = await db.menu_items.find_one({"id": item_data["menu_item_id"]}, {"_id": 0})
        if not menu_item or not menu_item.get("recipe"):
            continue
        for ingredient in menu_item["recipe"]:
            qty_to_deduct = ingredient["quantity_needed"] * item_data["quantity"]
            inv_item = await db.inventory.find_one({
                "id": ingredient["inventory_item_id"],
                "restaurant_id": restaurant_id
            })
            if inv_item:
                new_qty = max(0, inv_item["quantity"] - qty_to_deduct)
                await db.inventory.update_one(
                    {"id": ingredient["inventory_item_id"]},
                    {"$set": {
                        "quantity": new_qty,
                        "is_low_stock": new_qty <= inv_item["min_quantity"]
                    }}
                )

async def record_wallet_transaction(restaurant_id: str, txn_type: str, amount: float, payment_method: str, reference_id: str = None, day_session_id: str = None):
    txn = {
        "id": str(uuid.uuid4()),
        "restaurant_id": restaurant_id,
        "transaction_type": txn_type,
        "amount": amount,
        "payment_method": payment_method,
        "reference_id": reference_id,
        "day_session_id": day_session_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_transactions.insert_one(txn)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "owner",
        "restaurant_id": None,
        "branch_id": None,
        "onboarding_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    await log_action("auth", "user_registered", user_id=user_id)

    token = create_token(user_id, "owner")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, role="owner", restaurant_id=None, branch_id=None, created_at=user["created_at"])
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
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"],
                          restaurant_id=user.get("restaurant_id"), branch_id=user.get("branch_id"),
                          created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"],
                        restaurant_id=user.get("restaurant_id"), branch_id=user.get("branch_id"),
                        created_at=user["created_at"])

@api_router.get("/auth/permissions")
async def get_permissions(user: dict = Depends(get_current_user)):
    role = user.get("role", "")
    if role == "admin":
        return {"role": role, "permissions": list(ROLE_ACCESS.get("owner", set()))}
    return {"role": role, "permissions": list(ROLE_ACCESS.get(role, set()))}

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
        "is_active": False,
        "subscription_status": "pending",
        "subscription_expires": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.restaurants.insert_one(restaurant)

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"restaurant_id": restaurant_id, "onboarding_complete": True}}
    )

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
        await db.restaurants.update_one({"id": user["restaurant_id"]}, {"$set": update_data})
    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    return RestaurantResponse(**restaurant)

# ============== BRANCH ROUTES ==============

@api_router.post("/branches", response_model=BranchResponse)
async def create_branch(data: BranchCreate, user: dict = Depends(get_current_user)):
    check_role(user, "branches")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    branch_id = str(uuid.uuid4())
    branch = {
        "id": branch_id,
        "restaurant_id": user["restaurant_id"],
        "name": data.name,
        "address": data.address,
        "city": data.city,
        "pincode": data.pincode,
        "contact_phone": data.contact_phone,
        "share_menu": data.share_menu,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.branches.insert_one(branch)

    # If not sharing menu, create independent tables for branch
    return BranchResponse(**{k: v for k, v in branch.items() if k != "_id"})

@api_router.get("/branches", response_model=List[BranchResponse])
async def get_branches(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    branches = await db.branches.find({"restaurant_id": user["restaurant_id"], "is_active": True}, {"_id": 0}).to_list(50)
    return [BranchResponse(**b) for b in branches]

@api_router.put("/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(branch_id: str, data: BranchCreate, user: dict = Depends(get_current_user)):
    check_role(user, "branches")
    update_data = data.model_dump()
    await db.branches.update_one(
        {"id": branch_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": update_data}
    )
    branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return BranchResponse(**branch)

@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "branches")
    result = await db.branches.update_one(
        {"id": branch_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted"}

# ============== SUBSCRIPTION ROUTES ==============

@api_router.post("/subscriptions/create", response_model=SubscriptionResponse)
async def create_subscription(data: SubscriptionCreate, user: dict = Depends(get_current_user)):
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

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

    await db.restaurants.update_one(
        {"id": data.restaurant_id},
        {"$set": {"is_active": True, "subscription_status": "active", "subscription_expires": expires_at.isoformat()}}
    )
    await log_action("subscription", "subscription_created", user_id=user["id"], restaurant_id=data.restaurant_id)
    return SubscriptionResponse(**{k: v for k, v in subscription.items() if k != "_id"})

@api_router.get("/subscriptions/my", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    subscriptions = await db.subscriptions.find({"restaurant_id": user["restaurant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [SubscriptionResponse(**s) for s in subscriptions]

# ============== MENU CATEGORY ROUTES ==============

@api_router.post("/menu/categories", response_model=MenuCategoryResponse)
async def create_category(data: MenuCategoryCreate, user: dict = Depends(get_current_user)):
    check_role(user, "menu")
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
        {"restaurant_id": user["restaurant_id"], "is_active": True}, {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return [MenuCategoryResponse(**c) for c in categories]

@api_router.delete("/menu/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "menu")
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
    check_role(user, "menu")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    item_id = str(uuid.uuid4())
    recipe_data = [r.model_dump() for r in data.recipe] if data.recipe else []
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
        "recipe": recipe_data,
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
    for item in items:
        if "recipe" not in item:
            item["recipe"] = []
    return [MenuItemResponse(**i) for i in items]

@api_router.put("/menu/items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: str, data: MenuItemUpdate, user: dict = Depends(get_current_user)):
    check_role(user, "menu")
    update_data = {}
    for k, v in data.model_dump().items():
        if v is not None:
            if k == "recipe":
                update_data[k] = v
            else:
                update_data[k] = v
    if update_data:
        await db.menu_items.update_one(
            {"id": item_id, "restaurant_id": user.get("restaurant_id")},
            {"$set": update_data}
        )
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if "recipe" not in item:
        item["recipe"] = []
    return MenuItemResponse(**item)

@api_router.delete("/menu/items/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "menu")
    result = await db.menu_items.delete_one({"id": item_id, "restaurant_id": user.get("restaurant_id")})
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
    existing = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"})
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
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="No open day session")
    orders = await db.orders.find({"day_session_id": session["id"], "payment_status": "paid"}, {"_id": 0}).to_list(1000)
    total_sales = sum(o["total_amount"] for o in orders)
    cash_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "cash")
    card_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "card")
    upi_sales = sum(o["total_amount"] for o in orders if o["payment_method"] == "upi")
    now = datetime.now(timezone.utc)
    await db.day_sessions.update_one(
        {"id": session["id"]},
        {"$set": {"status": "closed", "closed_at": now.isoformat(), "closing_cash": closing_cash,
                  "total_sales": total_sales, "total_orders": len(orders),
                  "cash_sales": cash_sales, "card_sales": card_sales, "upi_sales": upi_sales}}
    )
    updated = await db.day_sessions.find_one({"id": session["id"]}, {"_id": 0})
    await log_action("day_session", "day_closed", user_id=user["id"], restaurant_id=user["restaurant_id"])
    return DaySessionResponse(**{k: v for k, v in updated.items() if k not in ["_id", "opened_by"]})

@api_router.get("/day-session/current", response_model=Optional[DaySessionResponse])
async def get_current_session(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return None
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        return None
    return DaySessionResponse(**{k: v for k, v in session.items() if k not in ["_id", "opened_by"]})

@api_router.get("/day-session/history", response_model=List[DaySessionResponse])
async def get_session_history(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    sessions = await db.day_sessions.find({"restaurant_id": user["restaurant_id"]}, {"_id": 0, "opened_by": 0}).sort("opened_at", -1).to_list(30)
    return [DaySessionResponse(**s) for s in sessions]

# ============== ORDER ROUTES ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    check_role(user, "menu_order")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="Day not open. Please open the day first.")

    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": user["restaurant_id"], "order_number": {"$regex": f"^{today}"}})
    order_number = f"{today}{count + 1:04d}"

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

    tax_rate = 0.05
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount - data.discount_amount, 2)

    # For dine-in with pending payment, payment_status is "pending"
    is_pending_payment = data.payment_method == "pending"
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
        "customer_email": data.customer_email,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "discount_amount": data.discount_amount,
        "total_amount": total_amount,
        "payment_method": data.payment_method,
        "payment_status": "pending" if is_pending_payment else "paid",
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

    # Deduct inventory
    await deduct_inventory(user["restaurant_id"], [{"menu_item_id": i.menu_item_id, "quantity": i.quantity} for i in data.items])

    # Record wallet transaction if paid
    if not is_pending_payment:
        await record_wallet_transaction(user["restaurant_id"], "sale", total_amount, data.payment_method, order_id, session["id"])

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
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        return []
    orders = await db.orders.find({"day_session_id": session["id"]}, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(500)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/running", response_model=List[OrderResponse])
async def get_running_orders(user: dict = Depends(get_current_user)):
    """Get orders that are not completed/cancelled (for table management)."""
    if not user.get("restaurant_id"):
        return []
    orders = await db.orders.find({
        "restaurant_id": user["restaurant_id"],
        "status": {"$nin": ["completed", "cancelled"]},
        "order_type": "dine_in"
    }, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(100)
    return [OrderResponse(**o) for o in orders]

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, data: OrderUpdate, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": data.status}})

    # Free table if completed and dine-in
    if data.status == "completed" and order["order_type"] == "dine_in" and order.get("table_number"):
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": order["table_number"]},
            {"$set": {"status": "available", "current_order_id": None}}
        )

    order["status"] = data.status
    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "created_by"]})

@api_router.post("/orders/{order_id}/add-items", response_model=OrderResponse)
async def add_items_to_order(order_id: str, data: OrderAddItems, user: dict = Depends(get_current_user)):
    """Add more items to a running dine-in order."""
    check_role(user, "menu_order")
    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot add items to completed/cancelled order")

    new_items = []
    additional_subtotal = 0
    for item_data in data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id}, {"_id": 0})
        if not menu_item:
            continue
        item_total = menu_item["price"] * item_data.quantity
        additional_subtotal += item_total
        new_items.append({
            "menu_item_id": item_data.menu_item_id,
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": item_data.quantity,
            "notes": item_data.notes,
            "total": item_total
        })

    all_items = order["items"] + new_items
    new_subtotal = sum(i["total"] for i in all_items)
    tax_amount = round(new_subtotal * 0.05, 2)
    total_amount = round(new_subtotal + tax_amount - order["discount_amount"], 2)

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"items": all_items, "subtotal": new_subtotal, "tax_amount": tax_amount, "total_amount": total_amount}}
    )

    await deduct_inventory(user["restaurant_id"], [{"menu_item_id": i.menu_item_id, "quantity": i.quantity} for i in data.items])

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**{k: v for k, v in updated.items() if k not in ["_id", "created_by"]})

@api_router.post("/orders/{order_id}/pay", response_model=OrderResponse)
async def pay_order(order_id: str, data: OrderPayment, user: dict = Depends(get_current_user)):
    """Complete payment for a running dine-in order and release the table."""
    check_role(user, "menu_order")
    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_method": data.payment_method, "payment_status": "paid", "status": "completed"}}
    )

    # Free table
    if order["order_type"] == "dine_in" and order.get("table_number"):
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": order["table_number"]},
            {"$set": {"status": "available", "current_order_id": None}}
        )

    # Record wallet transaction
    await record_wallet_transaction(
        user["restaurant_id"], "sale", order["total_amount"],
        data.payment_method, order_id, order.get("day_session_id")
    )

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**{k: v for k, v in updated.items() if k not in ["_id", "created_by"]})

# ============== KDS (Kitchen Display System) ROUTES ==============

@api_router.get("/kds/orders")
async def get_kds_orders(user: dict = Depends(get_current_user)):
    """Get active orders for the kitchen display."""
    check_role(user, "kds")
    if not user.get("restaurant_id"):
        return []
    orders = await db.orders.find({
        "restaurant_id": user["restaurant_id"],
        "status": {"$in": ["received", "preparing"]}
    }, {"_id": 0, "created_by": 0}).sort("created_at", 1).to_list(50)
    return orders

@api_router.put("/kds/orders/{order_id}/status")
async def update_kds_order_status(order_id: str, new_status: str, user: dict = Depends(get_current_user)):
    """Update order status from KDS (received -> preparing -> ready -> served)."""
    check_role(user, "kds")
    valid = ["preparing", "ready", "served"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
    await db.orders.update_one(
        {"id": order_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"status": new_status}}
    )
    return {"message": f"Order updated to {new_status}"}

# ============== INVENTORY ROUTES ==============

@api_router.post("/inventory", response_model=InventoryItemResponse)
async def create_inventory_item(data: InventoryItemCreate, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
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
    check_role(user, "inventory")
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if low_stock_only:
        query["is_low_stock"] = True
    items = await db.inventory.find(query, {"_id": 0}).to_list(500)
    return [InventoryItemResponse(**i) for i in items]

@api_router.put("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(item_id: str, data: InventoryItemUpdate, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
        if item:
            new_quantity = update_data.get("quantity", item["quantity"])
            new_min = update_data.get("min_quantity", item["min_quantity"])
            update_data["is_low_stock"] = new_quantity <= new_min
        await db.inventory.update_one({"id": item_id, "restaurant_id": user.get("restaurant_id")}, {"$set": update_data})
    item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse(**item)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    result = await db.inventory.delete_one({"id": item_id, "restaurant_id": user.get("restaurant_id")})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# ============== TABLE ROUTES ==============

@api_router.get("/tables", response_model=List[TableResponse])
async def get_tables(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    tables = await db.tables.find({"restaurant_id": user["restaurant_id"]}, {"_id": 0}).sort("table_number", 1).to_list(100)
    return [TableResponse(**t) for t in tables]

@api_router.post("/tables", response_model=TableResponse)
async def create_table(data: TableCreate, user: dict = Depends(get_current_user)):
    check_role(user, "tables")
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

@api_router.put("/tables/{table_id}/release")
async def release_table(table_id: str, user: dict = Depends(get_current_user)):
    """Release an occupied table (marks table as available, doesn't affect order)."""
    check_role(user, "tables")
    await db.tables.update_one(
        {"id": table_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"status": "available", "current_order_id": None}}
    )
    return {"message": "Table released"}

# ============== STAFF ROUTES ==============

@api_router.post("/staff", response_model=StaffResponse)
async def create_staff(data: StaffCreate, user: dict = Depends(get_current_user)):
    check_role(user, "staff")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    if user.get("role") not in ["owner", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only owners/managers can create staff")

    valid_roles = ["manager", "cashier", "captain", "chef"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

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
        "branch_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(staff)
    return StaffResponse(**{k: v for k, v in staff.items() if k not in ["_id", "password", "branch_id"]})

@api_router.get("/staff", response_model=List[StaffResponse])
async def get_staff(user: dict = Depends(get_current_user)):
    check_role(user, "staff")
    if not user.get("restaurant_id"):
        return []
    staff = await db.users.find(
        {"restaurant_id": user["restaurant_id"], "role": {"$in": ["manager", "cashier", "captain", "chef"]}},
        {"_id": 0, "password": 0}
    ).to_list(100)
    return [StaffResponse(**{k: v for k, v in s.items() if k not in ["branch_id", "onboarding_complete"]}) for s in staff]

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "staff")
    if user.get("role") not in ["owner", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only owners/managers can delete staff")
    result = await db.users.update_one(
        {"id": staff_id, "restaurant_id": user.get("restaurant_id")},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"message": "Staff deleted"}

# ============== WALLET ROUTES ==============

@api_router.get("/wallet/summary")
async def get_wallet_summary(period: str = "today", user: dict = Depends(get_current_user)):
    """Get wallet summary with payment method breakdown."""
    check_role(user, "wallet")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif period == "week":
        start = (now - timedelta(days=7)).isoformat()
    elif period == "month":
        start = (now - timedelta(days=30)).isoformat()
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    txns = await db.wallet_transactions.find({
        "restaurant_id": user["restaurant_id"],
        "created_at": {"$gte": start}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)

    total_cash = sum(t["amount"] for t in txns if t["payment_method"] == "cash" and t["transaction_type"] == "sale")
    total_card = sum(t["amount"] for t in txns if t["payment_method"] == "card" and t["transaction_type"] == "sale")
    total_upi = sum(t["amount"] for t in txns if t["payment_method"] == "upi" and t["transaction_type"] == "sale")
    total_refunds = sum(t["amount"] for t in txns if t["transaction_type"] == "refund")

    return {
        "total_cash": total_cash,
        "total_card": total_card,
        "total_upi": total_upi,
        "total_sales": total_cash + total_card + total_upi,
        "total_refunds": total_refunds,
        "net_amount": total_cash + total_card + total_upi - total_refunds,
        "transactions": txns[:50]
    }

# ============== ANALYTICS ROUTES ==============

@api_router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(user: dict = Depends(get_current_user)):
    check_role(user, "analytics")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    all_orders = await db.orders.find(
        {"restaurant_id": user["restaurant_id"], "payment_status": "paid"},
        {"_id": 0}
    ).to_list(10000)

    daily_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= today_start.isoformat())
    weekly_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= week_start.isoformat())
    monthly_sales = sum(o["total_amount"] for o in all_orders if o["created_at"] >= month_start.isoformat())

    item_counts = {}
    for order in all_orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + item.get("quantity", 1)
    top_items = sorted([{"name": k, "count": v} for k, v in item_counts.items()], key=lambda x: -x["count"])[:10]

    order_types = {}
    for order in all_orders:
        ot = order.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    hourly = {}
    for order in all_orders:
        try:
            hour = datetime.fromisoformat(order["created_at"]).hour
            hourly[hour] = hourly.get(hour, 0) + 1
        except:
            pass
    hourly_orders = [{"hour": h, "orders": c} for h, c in sorted(hourly.items())]

    payment_breakdown = {}
    for order in all_orders:
        pm = order.get("payment_method", "unknown")
        payment_breakdown[pm] = payment_breakdown.get(pm, 0) + order["total_amount"]

    return AnalyticsResponse(
        daily_sales=daily_sales, weekly_sales=weekly_sales, monthly_sales=monthly_sales,
        total_orders=len(all_orders), top_items=top_items, order_type_breakdown=order_types,
        hourly_orders=hourly_orders, payment_breakdown=payment_breakdown
    )

@api_router.post("/analytics/ai-insights")
async def get_ai_insights(user: dict = Depends(get_current_user)):
    """Generate AI-powered sales insights using Claude."""
    check_role(user, "analytics")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    # Gather data
    now = datetime.now(timezone.utc)
    month_start = (now - timedelta(days=30)).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()

    orders = await db.orders.find({
        "restaurant_id": user["restaurant_id"],
        "payment_status": "paid"
    }, {"_id": 0}).to_list(5000)

    monthly_orders = [o for o in orders if o["created_at"] >= month_start]
    weekly_orders = [o for o in orders if o["created_at"] >= week_start]

    monthly_sales = sum(o["total_amount"] for o in monthly_orders)
    weekly_sales = sum(o["total_amount"] for o in weekly_orders)
    avg_order_value = monthly_sales / len(monthly_orders) if monthly_orders else 0

    # Top items
    item_counts = {}
    for o in monthly_orders:
        for it in o.get("items", []):
            name = it.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + it.get("quantity", 1)
    top_items = sorted(item_counts.items(), key=lambda x: -x[1])[:5]

    # Payment breakdown
    payment_methods = {}
    for o in monthly_orders:
        pm = o.get("payment_method", "unknown")
        payment_methods[pm] = payment_methods.get(pm, 0) + o["total_amount"]

    order_types = {}
    for o in monthly_orders:
        ot = o.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    # Low stock items
    low_stock = await db.inventory.find({
        "restaurant_id": user["restaurant_id"],
        "is_low_stock": True
    }, {"_id": 0, "name": 1, "quantity": 1, "unit": 1}).to_list(20)

    data_summary = f"""
Restaurant Sales Report (Last 30 Days):
- Total Orders: {len(monthly_orders)}
- Monthly Revenue: ₹{monthly_sales:.2f}
- Weekly Revenue: ₹{weekly_sales:.2f}
- Average Order Value: ₹{avg_order_value:.2f}
- Top Items: {', '.join(f'{name} ({count})' for name, count in top_items)}
- Payment Methods: {', '.join(f'{k}: ₹{v:.2f}' for k, v in payment_methods.items())}
- Order Types: {', '.join(f'{k}: {v}' for k, v in order_types.items())}
- Low Stock Items: {', '.join(f'{i["name"]} ({i["quantity"]} {i.get("unit","")})' for i in low_stock) if low_stock else 'None'}
"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"analytics-{user['restaurant_id']}-{uuid.uuid4().hex[:8]}",
            system_message="You are a restaurant business analyst. Analyze the sales data and provide actionable insights. Keep your response concise with 3-5 key insights and 3-5 improvement suggestions. Use bullet points. Focus on revenue growth, menu optimization, and operational efficiency. Format with markdown headers."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        response = await chat.send_message(UserMessage(text=f"Analyze this restaurant data and provide insights:\n{data_summary}"))
        return {"insights": response, "data_summary": {"monthly_orders": len(monthly_orders), "monthly_sales": monthly_sales, "weekly_sales": weekly_sales, "avg_order_value": avg_order_value, "top_items": top_items}}
    except Exception as e:
        logger.error(f"AI insights error: {e}")
        return {"insights": f"AI insights temporarily unavailable. Error: {str(e)}", "data_summary": {"monthly_orders": len(monthly_orders), "monthly_sales": monthly_sales}}

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    total_restaurants = await db.restaurants.count_documents({})
    active_restaurants = await db.restaurants.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    month_start = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    subscriptions = await db.subscriptions.find({"created_at": {"$gte": month_start}}, {"_id": 0}).to_list(1000)
    monthly_revenue = sum(s["amount"] for s in subscriptions)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    daily_orders = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    return AdminStats(total_restaurants=total_restaurants, active_restaurants=active_restaurants,
                      total_users=total_users, monthly_revenue=monthly_revenue, daily_orders=daily_orders)

@api_router.get("/admin/restaurants")
async def get_all_restaurants(search: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"city": {"$regex": search, "$options": "i"}}]
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    restaurants = await db.restaurants.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return restaurants

@api_router.put("/admin/restaurants/{restaurant_id}/status")
async def update_restaurant_status(restaurant_id: str, is_active: bool, user: dict = Depends(get_admin_user)):
    result = await db.restaurants.update_one({"id": restaurant_id}, {"$set": {"is_active": is_active}})
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

# ============== WEBHOOK ROUTES (Mock) ==============

@api_router.post("/webhooks/swiggy")
async def swiggy_webhook(data: SwiggyWebhook):
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    session = await db.day_sessions.find_one({"restaurant_id": data.restaurant_id, "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="Restaurant day not open")
    order_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": data.restaurant_id, "order_number": {"$regex": f"^{today}"}})
    order = {
        "id": order_id, "order_number": f"{today}{count + 1:04d}",
        "restaurant_id": data.restaurant_id, "order_type": "online",
        "items": data.items, "customer_name": data.customer.get("name"),
        "customer_phone": data.customer.get("phone"),
        "subtotal": data.total_amount, "tax_amount": 0, "discount_amount": 0,
        "total_amount": data.total_amount, "payment_method": "online",
        "payment_status": "paid", "status": "received", "platform": "swiggy",
        "external_order_id": data.order_id, "delivery_address": data.delivery_address,
        "day_session_id": session["id"], "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    return {"message": "Order received", "order_id": order_id}

@api_router.post("/webhooks/zomato")
async def zomato_webhook(data: ZomatoWebhook):
    restaurant = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    session = await db.day_sessions.find_one({"restaurant_id": data.restaurant_id, "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="Restaurant day not open")
    order_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.orders.count_documents({"restaurant_id": data.restaurant_id, "order_number": {"$regex": f"^{today}"}})
    order = {
        "id": order_id, "order_number": f"{today}{count + 1:04d}",
        "restaurant_id": data.restaurant_id, "order_type": "online",
        "items": data.items, "customer_name": data.customer.get("name"),
        "customer_phone": data.customer.get("phone"),
        "subtotal": data.total_amount, "tax_amount": 0, "discount_amount": 0,
        "total_amount": data.total_amount, "payment_method": "online",
        "payment_status": "paid", "status": "received", "platform": "zomato",
        "external_order_id": data.order_id, "delivery_address": data.delivery_address,
        "day_session_id": session["id"], "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    return {"message": "Order received", "order_id": order_id}

# ============== PURCHASE ORDER ROUTES ==============

class PurchaseOrderItemCreate(BaseModel):
    inventory_item_id: str
    inventory_item_name: Optional[str] = None
    quantity: float
    unit: str
    unit_cost: float

class PurchaseOrderCreate(BaseModel):
    supplier_name: str
    supplier_contact: Optional[str] = None
    items: List[PurchaseOrderItemCreate]
    notes: Optional[str] = None
    expected_delivery: Optional[str] = None

@api_router.post("/purchase-orders")
async def create_purchase_order(data: PurchaseOrderCreate, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    po_id = str(uuid.uuid4())
    items_data = [item.model_dump() for item in data.items]
    total_cost = sum(i["quantity"] * i["unit_cost"] for i in items_data)
    po = {
        "id": po_id,
        "restaurant_id": user["restaurant_id"],
        "po_number": f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
        "supplier_name": data.supplier_name,
        "supplier_contact": data.supplier_contact,
        "items": items_data,
        "total_cost": total_cost,
        "notes": data.notes,
        "expected_delivery": data.expected_delivery,
        "status": "ordered",
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.purchase_orders.insert_one(po)
    return {k: v for k, v in po.items() if k != "_id"}

@api_router.get("/purchase-orders")
async def get_purchase_orders(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if status:
        query["status"] = status
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return pos

@api_router.put("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(po_id: str, user: dict = Depends(get_current_user)):
    """Mark a purchase order as received and update inventory quantities."""
    check_role(user, "inventory")
    po = await db.purchase_orders.find_one({"id": po_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po["status"] == "received":
        raise HTTPException(status_code=400, detail="Already received")

    # Update inventory quantities
    for item in po["items"]:
        inv = await db.inventory.find_one({"id": item["inventory_item_id"], "restaurant_id": user["restaurant_id"]})
        if inv:
            new_qty = inv["quantity"] + item["quantity"]
            await db.inventory.update_one(
                {"id": item["inventory_item_id"]},
                {"$set": {"quantity": new_qty, "is_low_stock": new_qty <= inv["min_quantity"]}}
            )

    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {"status": "received", "received_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Purchase order received, inventory updated"}

@api_router.put("/purchase-orders/{po_id}/cancel")
async def cancel_purchase_order(po_id: str, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    result = await db.purchase_orders.update_one(
        {"id": po_id, "restaurant_id": user.get("restaurant_id"), "status": "ordered"},
        {"$set": {"status": "cancelled"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found or already processed")
    return {"message": "Purchase order cancelled"}

# ============== RECEIPT ROUTE ==============

@api_router.get("/orders/{order_id}/receipt")
async def get_receipt(order_id: str, user: dict = Depends(get_current_user)):
    """Generate a receipt for a completed order."""
    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0, "created_by": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    return {
        "restaurant": {
            "name": restaurant.get("name", ""),
            "address": restaurant.get("address", ""),
            "city": restaurant.get("city", ""),
            "phone": restaurant.get("contact_phone", ""),
        },
        "order": order,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

# ============== DAY CLOSE REPORT ==============

@api_router.get("/day-session/{session_id}/report")
async def get_day_close_report(session_id: str, user: dict = Depends(get_current_user)):
    """Generate a detailed day close report."""
    session = await db.day_sessions.find_one({"id": session_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0, "opened_by": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    orders = await db.orders.find({"day_session_id": session_id}, {"_id": 0, "created_by": 0}).to_list(5000)

    paid_orders = [o for o in orders if o.get("payment_status") == "paid"]
    pending_orders = [o for o in orders if o.get("payment_status") == "pending"]
    cancelled_orders = [o for o in orders if o.get("status") == "cancelled"]

    total_sales = sum(o["total_amount"] for o in paid_orders)
    total_tax = sum(o.get("tax_amount", 0) for o in paid_orders)
    total_discount = sum(o.get("discount_amount", 0) for o in paid_orders)

    # Payment breakdown
    payment_methods = {}
    for o in paid_orders:
        pm = o.get("payment_method", "unknown")
        payment_methods[pm] = payment_methods.get(pm, 0) + o["total_amount"]

    # Order type breakdown
    order_types = {}
    for o in paid_orders:
        ot = o.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    # Top selling items
    item_counts = {}
    item_revenue = {}
    for o in paid_orders:
        for item in o.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            item_counts[name] = item_counts.get(name, 0) + qty
            item_revenue[name] = item_revenue.get(name, 0) + item.get("total", 0)
    top_items = sorted([{"name": k, "quantity": item_counts[k], "revenue": item_revenue.get(k, 0)} for k in item_counts], key=lambda x: -x["revenue"])[:10]

    # Hourly breakdown
    hourly = {}
    for o in paid_orders:
        try:
            hour = datetime.fromisoformat(o["created_at"]).hour
            hourly[hour] = hourly.get(hour, {"orders": 0, "revenue": 0})
            hourly[hour]["orders"] += 1
            hourly[hour]["revenue"] += o["total_amount"]
        except:
            pass
    hourly_data = [{"hour": f"{h:02d}:00", "orders": v["orders"], "revenue": v["revenue"]} for h, v in sorted(hourly.items())]

    return {
        "session": session,
        "summary": {
            "total_orders": len(paid_orders),
            "total_sales": total_sales,
            "total_tax": total_tax,
            "total_discount": total_discount,
            "average_order_value": total_sales / len(paid_orders) if paid_orders else 0,
            "pending_orders": len(pending_orders),
            "cancelled_orders": len(cancelled_orders),
        },
        "payment_breakdown": payment_methods,
        "order_type_breakdown": order_types,
        "top_items": top_items,
        "hourly_breakdown": hourly_data,
        "cash_summary": {
            "opening_cash": session.get("opening_cash", 0),
            "cash_sales": payment_methods.get("cash", 0),
            "expected_cash": session.get("opening_cash", 0) + payment_methods.get("cash", 0),
            "closing_cash": session.get("closing_cash"),
            "difference": (session.get("closing_cash") or 0) - (session.get("opening_cash", 0) + payment_methods.get("cash", 0)) if session.get("closing_cash") is not None else None,
        }
    }

# ============== CUSTOMER LOOKUP ==============

@api_router.get("/customers/lookup")
async def customer_lookup(phone: str = "", user: dict = Depends(get_current_user)):
    """Auto-suggest customers based on phone number from previous orders."""
    if not user.get("restaurant_id") or len(phone) < 3:
        return []
    pipeline = [
        {"$match": {"restaurant_id": user["restaurant_id"], "customer_phone": {"$regex": phone, "$options": "i"}}},
        {"$group": {"_id": "$customer_phone", "customer_name": {"$last": "$customer_name"}, "customer_email": {"$last": "$customer_email"}, "order_count": {"$sum": 1}}},
        {"$sort": {"order_count": -1}},
        {"$limit": 5}
    ]
    results = await db.orders.aggregate(pipeline).to_list(5)
    return [{"phone": r["_id"], "name": r.get("customer_name", ""), "email": r.get("customer_email", ""), "order_count": r["order_count"]} for r in results if r["_id"]]

# ============== DAY CLOSE PDF REPORT ==============

@api_router.get("/day-session/{session_id}/report-pdf")
async def get_day_close_report_pdf(session_id: str, token: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Generate a premium PDF day close report with AI insights."""
    from fastapi.responses import Response
    from fpdf import FPDF

    session = await db.day_sessions.find_one({"id": session_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0, "opened_by": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    orders = await db.orders.find({"day_session_id": session_id}, {"_id": 0, "created_by": 0}).to_list(5000)

    paid_orders = [o for o in orders if o.get("payment_status") == "paid"]
    pending_orders = [o for o in orders if o.get("payment_status") == "pending"]
    cancelled_orders = [o for o in orders if o.get("status") == "cancelled"]

    total_sales = sum(o["total_amount"] for o in paid_orders)
    total_tax = sum(o.get("tax_amount", 0) for o in paid_orders)
    total_discount = sum(o.get("discount_amount", 0) for o in paid_orders)
    avg_order = total_sales / len(paid_orders) if paid_orders else 0

    payment_methods = {}
    for o in paid_orders:
        pm = o.get("payment_method", "unknown")
        payment_methods[pm] = payment_methods.get(pm, 0) + o["total_amount"]

    order_types = {}
    for o in paid_orders:
        ot = o.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    item_counts = {}
    item_revenue = {}
    for o in paid_orders:
        for item in o.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            item_counts[name] = item_counts.get(name, 0) + qty
            item_revenue[name] = item_revenue.get(name, 0) + item.get("total", 0)
    top_items = sorted([{"name": k, "quantity": item_counts[k], "revenue": item_revenue.get(k, 0)} for k in item_counts], key=lambda x: -x["revenue"])[:10]

    hourly = {}
    for o in paid_orders:
        try:
            hour = datetime.fromisoformat(o["created_at"]).hour
            hourly[hour] = hourly.get(hour, {"orders": 0, "revenue": 0})
            hourly[hour]["orders"] += 1
            hourly[hour]["revenue"] += o["total_amount"]
        except:
            pass

    # Generate AI insights
    ai_insights = ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        data_summary = f"""
Day Close Report - {session.get('date', 'Today')}:
- Total Paid Orders: {len(paid_orders)}
- Total Sales: Rs.{total_sales:.2f}
- Average Order Value: Rs.{avg_order:.2f}
- Payment Methods: {', '.join(f'{k}: Rs.{v:.2f}' for k, v in payment_methods.items())}
- Order Types: {', '.join(f'{k}: {v}' for k, v in order_types.items())}
- Top Items: {', '.join(f'{i["name"]} ({i["quantity"]} sold, Rs.{i["revenue"]:.2f})' for i in top_items[:5])}
- Pending Orders: {len(pending_orders)}
- Cancelled Orders: {len(cancelled_orders)}
- Peak Hours: {', '.join(f'{h}:00 ({d["orders"]} orders, Rs.{d["revenue"]:.2f})' for h, d in sorted(hourly.items(), key=lambda x: -x[1]["revenue"])[:3]) if hourly else 'N/A'}
"""
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dayclose-{session_id}-{uuid.uuid4().hex[:8]}",
            system_message="You are a restaurant business consultant. Based on today's sales data, provide 3-5 actionable suggestions for tomorrow to improve sales and operations. Be specific and practical. Use bullet points. Keep it under 200 words."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=f"Based on today's performance, give me suggestions for tomorrow:\n{data_summary}"))
        ai_insights = response
    except Exception as e:
        logger.error(f"AI insights for PDF error: {e}")
        ai_insights = "AI insights unavailable at this time."

    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_fill_color(30, 41, 59)  # slate-800
    pdf.rect(0, 0, 210, 40, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_y(8)
    pdf.cell(0, 10, restaurant.get("name", "Restaurant") if restaurant else "Restaurant", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Daily Sales Report - {session.get('date', '')}", align="C", new_x="LMARGIN", new_y="NEXT")
    opened = session.get("opened_at", "")
    closed = session.get("closed_at", "")
    try:
        opened = datetime.fromisoformat(opened).strftime("%I:%M %p") if opened else ""
        closed = datetime.fromisoformat(closed).strftime("%I:%M %p") if closed else "Ongoing"
    except:
        pass
    pdf.cell(0, 6, f"Session: {opened} - {closed}", align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(48)
    pdf.set_text_color(0, 0, 0)

    # Sales Summary Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_fill_color(241, 245, 249)  # slate-100
    pdf.cell(0, 10, "  Sales Summary", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 11)
    summary_data = [
        ("Total Sales", f"Rs.{total_sales:,.2f}"),
        ("Total Orders", str(len(paid_orders))),
        ("Average Order Value", f"Rs.{avg_order:,.2f}"),
        ("Total Tax Collected", f"Rs.{total_tax:,.2f}"),
        ("Total Discounts", f"Rs.{total_discount:,.2f}"),
        ("Pending Orders", str(len(pending_orders))),
        ("Cancelled Orders", str(len(cancelled_orders))),
    ]
    for label, value in summary_data:
        pdf.cell(100, 7, f"  {label}", new_x="RIGHT")
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
    pdf.ln(4)

    # Payment Breakdown
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "  Payment Breakdown", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 11)
    for method, amount in payment_methods.items():
        pdf.cell(100, 7, f"  {method.upper()}", new_x="RIGHT")
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, f"Rs.{amount:,.2f}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
    pdf.ln(4)

    # Cash Drawer
    opening_cash = session.get("opening_cash", 0)
    closing_cash = session.get("closing_cash")
    cash_sales = payment_methods.get("cash", 0)
    expected = opening_cash + cash_sales

    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "  Cash Drawer", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 11)
    cash_data = [("Opening Cash", f"Rs.{opening_cash:,.2f}"), ("Cash Sales", f"Rs.{cash_sales:,.2f}"), ("Expected Cash", f"Rs.{expected:,.2f}")]
    if closing_cash is not None:
        cash_data.append(("Closing Cash", f"Rs.{closing_cash:,.2f}"))
        diff = closing_cash - expected
        cash_data.append(("Difference", f"Rs.{diff:,.2f}"))
    for label, value in cash_data:
        pdf.cell(100, 7, f"  {label}", new_x="RIGHT")
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
    pdf.ln(4)

    # Top Selling Items Table
    if top_items:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "  Top Selling Items", fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        # Table header
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(226, 232, 240)  # slate-200
        pdf.cell(10, 7, "#", border=1, fill=True, align="C")
        pdf.cell(80, 7, "Item Name", border=1, fill=True)
        pdf.cell(30, 7, "Qty Sold", border=1, fill=True, align="C")
        pdf.cell(40, 7, "Revenue", border=1, fill=True, align="R")
        pdf.ln()
        pdf.set_font("Helvetica", "", 10)
        for i, item in enumerate(top_items):
            pdf.cell(10, 7, str(i + 1), border=1, align="C")
            pdf.cell(80, 7, f"  {item['name'][:30]}", border=1)
            pdf.cell(30, 7, str(item["quantity"]), border=1, align="C")
            pdf.cell(40, 7, f"Rs.{item['revenue']:,.2f}  ", border=1, align="R")
            pdf.ln()
        pdf.ln(4)

    # Hourly Breakdown
    if hourly:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "  Hourly Breakdown", fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(226, 232, 240)
        pdf.cell(40, 7, "Hour", border=1, fill=True, align="C")
        pdf.cell(40, 7, "Orders", border=1, fill=True, align="C")
        pdf.cell(50, 7, "Revenue", border=1, fill=True, align="R")
        pdf.ln()
        pdf.set_font("Helvetica", "", 10)
        for h in sorted(hourly.keys()):
            pdf.cell(40, 7, f"{h:02d}:00", border=1, align="C")
            pdf.cell(40, 7, str(hourly[h]["orders"]), border=1, align="C")
            pdf.cell(50, 7, f"Rs.{hourly[h]['revenue']:,.2f}", border=1, align="R")
            pdf.ln()
        pdf.ln(4)

    # AI Insights Section
    pdf.add_page()
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(0, 0, 210, 25, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_y(6)
    pdf.cell(0, 12, "  AI-Powered Insights & Suggestions", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_y(32)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 11)
    # Clean markdown from AI response and replace unsupported Unicode characters
    clean_insights = ai_insights.replace("**", "").replace("##", "").replace("# ", "")
    # Replace Unicode bullets with ASCII dashes (Helvetica doesn't support •)
    clean_insights = clean_insights.replace("•", "-").replace("→", "->").replace("—", "-")
    for line in clean_insights.split("\n"):
        line = line.strip()
        if not line:
            pdf.ln(3)
            continue
        if line.startswith("- ") or line.startswith("* "):
            pdf.set_font("Helvetica", "", 11)
            pdf.multi_cell(0, 6, f"  {line}", new_x="LMARGIN", new_y="NEXT")
        elif any(line.startswith(f"{i}.") for i in range(1, 10)):
            pdf.set_font("Helvetica", "", 11)
            pdf.multi_cell(0, 6, f"  {line}", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(0, 7, line, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 11)
    pdf.ln(8)

    # Footer
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, f"Generated by FoodFlow POS on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", align="C")

    pdf_bytes = pdf.output()
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=day-report-{session.get('date', 'report')}.pdf"}
    )

@api_router.get("/day-session/{session_id}/ai-insights")
async def get_day_close_ai_insights(session_id: str, user: dict = Depends(get_current_user)):
    """Get AI insights for a day session for in-app display."""
    session = await db.day_sessions.find_one({"id": session_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0, "opened_by": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    orders = await db.orders.find({"day_session_id": session_id, "payment_status": "paid"}, {"_id": 0}).to_list(5000)
    total_sales = sum(o["total_amount"] for o in orders)
    avg_order = total_sales / len(orders) if orders else 0

    payment_methods = {}
    for o in orders:
        pm = o.get("payment_method", "unknown")
        payment_methods[pm] = payment_methods.get(pm, 0) + o["total_amount"]

    order_types = {}
    for o in orders:
        ot = o.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    item_counts = {}
    for o in orders:
        for item in o.get("items", []):
            name = item.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + item.get("quantity", 1)
    top_items = sorted(item_counts.items(), key=lambda x: -x[1])[:5]

    hourly = {}
    for o in orders:
        try:
            hour = datetime.fromisoformat(o["created_at"]).hour
            hourly[hour] = hourly.get(hour, 0) + 1
        except:
            pass
    peak_hours = sorted(hourly.items(), key=lambda x: -x[1])[:3]

    data_summary = f"""
Day Close Report - {session.get('date', 'Today')}:
- Total Paid Orders: {len(orders)}
- Total Sales: Rs.{total_sales:.2f}
- Average Order Value: Rs.{avg_order:.2f}
- Payment Methods: {', '.join(f'{k}: Rs.{v:.2f}' for k, v in payment_methods.items())}
- Order Types: {', '.join(f'{k}: {v}' for k, v in order_types.items())}
- Top Items: {', '.join(f'{name} ({count} sold)' for name, count in top_items)}
- Peak Hours: {', '.join(f'{h}:00 ({c} orders)' for h, c in peak_hours) if peak_hours else 'N/A'}
"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dayclose-insights-{session_id}-{uuid.uuid4().hex[:8]}",
            system_message="You are a restaurant business consultant. Based on today's sales data, provide 3-5 actionable suggestions for tomorrow to improve sales and operations. Be specific and practical. Use bullet points. Keep it under 200 words."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=f"Based on today's performance, give me suggestions for tomorrow:\n{data_summary}"))
        return {"insights": response}
    except Exception as e:
        logger.error(f"Day close AI insights error: {e}")
        return {"insights": "AI insights temporarily unavailable."}

# ============== UTILITY ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "FoodFlow POS API", "version": "2.0.0"}

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
    admin = await db.users.find_one({"email": "admin@foodflow.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@foodflow.com",
            "password": hash_password("admin123"),
            "name": "Platform Admin",
            "role": "admin",
            "restaurant_id": None,
            "branch_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Admin user created: admin@foodflow.com / admin123")

    await db.users.create_index("email", unique=True)
    await db.restaurants.create_index("owner_id")
    await db.orders.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.menu_items.create_index([("restaurant_id", 1), ("category_id", 1)])
    await db.wallet_transactions.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.branches.create_index("restaurant_id")
    await db.purchase_orders.create_index([("restaurant_id", 1), ("created_at", -1)])
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
