from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncio
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.staticfiles import StaticFiles
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import shutil
import smtplib
from email.mime.text import MIMEText
from contextlib import asynccontextmanager

# Google Gemini AI
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', '')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'DineDesk')]

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_SIZE_MB = int(os.environ.get('MAX_UPLOAD_SIZE_MB', '10'))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# JWT Configuration — secret must come from the environment only.
# No hardcoded fallback: a committed secret is a compromised secret.
JWT_SECRET = os.environ.get('JWT_SECRET', '')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required — generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))

# Restaurant timezone — all day boundaries, analytics and peak-hours are
# computed in this zone (default IST) instead of UTC.
try:
    from zoneinfo import ZoneInfo
    RESTAURANT_TZ = ZoneInfo(os.environ.get('RESTAURANT_TZ', 'Asia/Kolkata'))
except Exception:
    RESTAURANT_TZ = timezone.utc

# Email verification flow: when True AND an email provider is configured,
# users must click the emailed link before logging in. When False (default,
# dev/self-host), accounts are auto-verified at registration so signup works
# without any email provider — no more permanent lockout.
EMAIL_VERIFICATION_REQUIRED = os.environ.get('EMAIL_VERIFICATION_REQUIRED', 'false').strip().lower() in ('true', '1', 'yes')

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Gemini AI Config
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
if GEMINI_API_KEY and GEMINI_AVAILABLE:
    genai.configure(api_key=GEMINI_API_KEY)

# Twilio Config
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# Gmail SMTP Config — no fallback credentials
GMAIL_USER = os.environ.get('GMAIL_USER', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', GMAIL_USER)
SENDER_NAME = os.environ.get('SENDER_NAME', 'DineDesk')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# SendGrid Config — HTTPS API (works on Render free tier, unlike SMTP)
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', SENDER_EMAIL or 'support@revontechnologies.in')
SENDGRID_FROM_NAME = os.environ.get('SENDGRID_FROM_NAME', SENDER_NAME)

# True when any email provider (SendGrid or Gmail SMTP) is configured —
# gates the mandatory email-verification flow.
EMAIL_CONFIGURED = bool(SENDGRID_API_KEY or (GMAIL_USER and GMAIL_APP_PASSWORD))

# Admin bootstrap credentials — from env only
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@dinedesk.in')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

# Public demo tenant for product walkthroughs (email + password + full access)
DEMO_EMAIL = os.environ.get('DEMO_EMAIL', 'demo@dinedesk.in')
DEMO_PASSWORD = os.environ.get('DEMO_PASSWORD', '123456')

# Lifespan context manager
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # --- Startup ---
    background_tasks = []
    try:
        if ADMIN_PASSWORD:
            admin = await db.users.find_one({"email": ADMIN_EMAIL})
            if not admin:
                admin_user = {
                    "id": str(uuid.uuid4()),
                    "email": ADMIN_EMAIL,
                    "password": hash_password(ADMIN_PASSWORD),
                    "name": "Platform Admin",
                    "role": "admin",
                    "restaurant_id": None,
                    "branch_id": None,
                    "is_verified": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(admin_user)
                logger.info(f"Admin user created: {ADMIN_EMAIL}")
        else:
            logger.warning("ADMIN_PASSWORD not set — skipping admin bootstrap")

        # --- Demo account seed ---
        # A ready-to-explore tenant (demo@dinedesk.in / 123456) with a
        # fully active subscription and every Store add-on enabled, so
        # reviewers see the complete product instead of empty screens.
        try:
            demo = await db.users.find_one({"email": DEMO_EMAIL})
            if not demo:
                demo_user = {
                    "id": str(uuid.uuid4()),
                    "email": DEMO_EMAIL,
                    "password": hash_password(DEMO_PASSWORD),
                    "name": "Demo Owner",
                    "role": "owner",
                    "restaurant_id": None,  # filled below
                    "branch_id": None,
                    "is_verified": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

                demo_restaurant = {
                    "id": str(uuid.uuid4()),
                    "owner_id": demo_user["id"],
                    "name": "DineDesk Demo Kitchen",
                    "restaurant_type": "casual_dining",
                    "num_tables": 8,
                    "avg_daily_orders": 60,
                    "uses_delivery": True,
                    "delivery_platforms": ["swiggy", "zomato"],
                    "contact_phone": "+91 98403 93658",
                    "contact_email": DEMO_EMAIL,
                    "address": "12 Anna Salai",
                    "city": "Chennai",
                    "pincode": "600002",
                    "tax_rate": 5.0,
                    "fssai_license_number": "22426478000602",
                    "fssai_expiry_date": (datetime.now(timezone.utc) + timedelta(days=21)).strftime("%Y-%m-%d"),
                    "fssai_verified": True,
                    "fssai_verified_at": datetime.now(timezone.utc).isoformat(),
                    "is_active": True,
                    "subscription_status": "active",
                    "subscription_expires": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                demo_user["restaurant_id"] = demo_restaurant["id"]
                await db.restaurants.insert_one(demo_restaurant)

                # Tables matching num_tables
                for i in range(1, demo_restaurant["num_tables"] + 1):
                    await db.tables.insert_one({
                        "id": str(uuid.uuid4()),
                        "restaurant_id": demo_restaurant["id"],
                        "table_number": i,
                        "capacity": 4,
                        "status": "available",
                        "current_order_id": None,
                    })

                # Menu: 4 categories × 3-4 items with recipes wired to
                # demo inventory, so automatic deduction is visible.
                demo_inventory = [
                    {"id": str(uuid.uuid4()), "name": "Idli/Dosa Batter", "unit": "kg", "quantity": 25.0, "min_quantity": 5.0, "cost_per_unit": 60.0},
                    {"id": str(uuid.uuid4()), "name": "Sambar Dal", "unit": "kg", "quantity": 12.0, "min_quantity": 3.0, "cost_per_unit": 90.0},
                    {"id": str(uuid.uuid4()), "name": "Filter Coffee Powder", "unit": "kg", "quantity": 4.0, "min_quantity": 1.0, "cost_per_unit": 450.0},
                    {"id": str(uuid.uuid4()), "name": "Cooking Oil", "unit": "L", "quantity": 18.0, "min_quantity": 4.0, "cost_per_unit": 130.0},
                    {"id": str(uuid.uuid4()), "name": "Basmati Rice", "unit": "kg", "quantity": 30.0, "min_quantity": 6.0, "cost_per_unit": 95.0},
                ]
                for item in demo_inventory:
                    await db.inventory.insert_one({**item, "restaurant_id": demo_restaurant["id"], "is_low_stock": item["quantity"] <= item["min_quantity"], "supplier": "Demo Supplier", "created_at": datetime.now(timezone.utc).isoformat()})
                inv = {i["name"]: i["id"] for i in demo_inventory}

                def recipe(*pairs):
                    return [
                        {
                            "inventory_item_id": inv[name],
                            "inventory_item_name": name,
                            "quantity_needed": qty,
                            "unit": unit,
                        }
                        for name, qty, unit in pairs
                    ]

                demo_categories = [
                    ("Starters", 1, [
                        ("Medu Vada", 60, True, recipe(("Idli/Dosa Batter", 0.15, "kg"), ("Cooking Oil", 0.1, "L"))),
                        ("Sambar Rice", 90, True, recipe(("Sambar Dal", 0.2, "kg"), ("Basmati Rice", 0.25, "kg"))),
                    ]),
                    ("Main Course", 2, [
                        ("Idli Combo (3 pc)", 80, True, recipe(("Idli/Dosa Batter", 0.3, "kg"), ("Sambar Dal", 0.15, "kg"))),
                        ("Ghee Roast Dosa", 110, True, recipe(("Idli/Dosa Batter", 0.25, "kg"), ("Cooking Oil", 0.05, "L"))),
                        ("Curd Rice", 70, True, recipe(("Basmati Rice", 0.2, "kg"))),
                    ]),
                    ("Beverages", 3, [
                        ("Filter Coffee", 30, True, recipe(("Filter Coffee Powder", 0.02, "kg"))),
                        ("Masala Chai", 25, True, recipe(("Filter Coffee Powder", 0.015, "kg"))),
                    ]),
                ]
                now = datetime.now(timezone.utc).isoformat()
                for cat_name, sort_order, items in demo_categories:
                    cat_id = str(uuid.uuid4())
                    await db.menu_categories.insert_one({
                        "id": cat_id,
                        "restaurant_id": demo_restaurant["id"],
                        "name": cat_name,
                        "description": None,
                        "sort_order": sort_order,
                        "is_active": True,
                        "created_at": now,
                    })
                    for item_name, price, is_veg, item_recipe in items:
                        await db.menu_items.insert_one({
                            "id": str(uuid.uuid4()),
                            "restaurant_id": demo_restaurant["id"],
                            "category_id": cat_id,
                            "name": item_name,
                            "description": None,
                            "price": float(price),
                            "image_url": None,
                            "is_vegetarian": is_veg,
                            "is_available": True,
                            "preparation_time": 12,
                            "recipe": item_recipe,
                            "created_at": now,
                        })

                # Subscription: every Store add-on active + starter plan
                await db.restaurant_subscriptions.insert_one({
                    "restaurant_id": demo_restaurant["id"],
                    "active_addons": [a["id"] for a in STORE_ADDONS],
                    "plan": "starter",
                    "updated_at": now,
                })

                await db.users.insert_one(demo_user)
                logger.info(f"Demo account seeded: {DEMO_EMAIL} (restaurant: {demo_restaurant['name']})")
            else:
                # Top up the add-on list if new modules shipped since seed
                sub = await db.restaurant_subscriptions.find_one({"restaurant_id": demo.get("restaurant_id")})
                if sub and set(a["id"] for a in STORE_ADDONS) - set(sub.get("active_addons", [])):
                    await db.restaurant_subscriptions.update_one(
                        {"restaurant_id": sub["restaurant_id"]},
                        {"$set": {"active_addons": [a["id"] for a in STORE_ADDONS]}},
                    )
                # Repair seeded inventory rows created before is_low_stock
                # existed (the response model requires the flag).
                if demo.get("restaurant_id"):
                    await db.inventory.update_many(
                        {"restaurant_id": demo["restaurant_id"], "is_low_stock": {"$exists": False}},
                        [{"$set": {"is_low_stock": {"$lte": ["$quantity", "$min_quantity"]}}}],
                    )
                    # Backfill FSSAI license fields for tenants created before
                    # license registration existed.
                    await db.restaurants.update_one(
                        {"id": demo["restaurant_id"], "fssai_license_number": {"$in": [None, ""]}},
                        {"$set": {
                            "fssai_license_number": "22426478000602",
                            "fssai_expiry_date": (datetime.now(timezone.utc) + timedelta(days=21)).strftime("%Y-%m-%d"),
                            "fssai_verified": True,
                            "fssai_verified_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
        except Exception as e:
            logger.warning(f"Demo seed skipped: {e}")

        await db.users.create_index("email", unique=True)
        await db.restaurants.create_index("owner_id")
        await db.orders.create_index([("restaurant_id", 1), ("created_at", -1)])
        await db.menu_items.create_index([("restaurant_id", 1), ("category_id", 1)])
        await db.wallet_transactions.create_index([("restaurant_id", 1), ("created_at", -1)])
        await db.branches.create_index("restaurant_id")
        await db.purchase_orders.create_index([("restaurant_id", 1), ("created_at", -1)])
        logger.info("Database indexes created")
        reverify_task = asyncio.create_task(license_reverification_loop())
        background_tasks.append(reverify_task)
    except Exception as e:
        logger.warning(f"Startup DB init skipped (will retry on first request): {e}")
    yield
    # --- Shutdown ---
    for task in background_tasks:
        task.cancel()
    client.close()
    logger.info("MongoDB connection closed")

# Create the main app
app = FastAPI(title="DineDesk POS API", version="3.0.0", lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting (simple in-memory)
from collections import defaultdict
import time

_rate_limit_store: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get('RATE_LIMIT_MAX_REQUESTS', '30'))


def _check_rate_limit(key: str, max_requests: int = RATE_LIMIT_MAX_REQUESTS) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.time()
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[key]) >= max_requests:
        return False
    _rate_limit_store[key].append(now)
    return True

# ============== PYDANTIC MODELS ==============

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token

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

class RegisterResponse(BaseModel):
    message: str
    email: str

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

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
    tax_rate: float = 5.0  # GST/restaurant tax percent
    fssai_license_number: str = ""  # 14-digit FSSAI food license (mandatory at registration)
    fssai_expiry_date: Optional[str] = None  # ISO date (YYYY-MM-DD)

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    num_tables: Optional[int] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    tax_rate: Optional[float] = None
    fssai_license_number: Optional[str] = None
    fssai_expiry_date: Optional[str] = None

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
    tax_rate: float = 5.0
    is_active: bool
    subscription_status: str
    subscription_expires: Optional[str] = None
    created_at: str
    owner_id: str
    fssai_license_number: str = ""
    fssai_expiry_date: Optional[str] = None
    fssai_verified: bool = False
    fssai_verified_at: Optional[str] = None
    fssai_registry_status: Optional[str] = None
    fssai_registry_entity: Optional[str] = None
    fssai_registry_type: Optional[str] = None
    fssai_registry_premises: Optional[str] = None
    fssai_registry_checked_at: Optional[str] = None

# Branch Models
class BranchCreate(BaseModel):
    name: str
    address: str
    city: str
    pincode: str
    contact_phone: str
    share_menu: bool = True
    login_email: Optional[str] = None
    login_password: Optional[str] = None

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

class PaymentSplit(BaseModel):
    method: str  # cash, card, upi
    amount: float

class OrderCreate(BaseModel):
    order_type: str
    table_number: Optional[int] = None
    items: List[OrderItemCreate]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    payment_method: str = "pending"
    payment_splits: Optional[List[PaymentSplit]] = None
    change_amount: Optional[float] = 0
    discount_amount: float = 0
    platform: Optional[str] = None

class OrderAddItems(BaseModel):
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: str

class OrderPayment(BaseModel):
    payment_method: Optional[str] = None  # legacy single method
    payment_splits: Optional[List[PaymentSplit]] = None  # split payments
    change_amount: Optional[float] = 0  # change returned to customer

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
    payment_splits: Optional[List[Dict[str, Any]]] = None
    change_amount: Optional[float] = 0

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
    role: str

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
    transaction_type: str
    amount: float
    payment_method: str
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


def _restock_inventory(restaurant_id: str, order_items: list):
    """Fire-and-forget inventory restore for cancelled orders (recipe-aware).

    Restores the same quantities that deduct_inventory removed. Runs as a
    background task so cancellation stays fast; failures are logged.
    """
    async def _run():
        try:
            for item_data in order_items:
                menu_item = await db.menu_items.find_one({"id": item_data["menu_item_id"]}, {"_id": 0})
                if not menu_item or not menu_item.get("recipe"):
                    continue
                for ingredient in menu_item["recipe"]:
                    qty_to_restore = ingredient["quantity_needed"] * item_data.get("quantity", 0)
                    inv_item = await db.inventory.find_one({
                        "id": ingredient["inventory_item_id"],
                        "restaurant_id": restaurant_id
                    })
                    if inv_item:
                        new_qty = inv_item["quantity"] + qty_to_restore
                        await db.inventory.update_one(
                            {"id": ingredient["inventory_item_id"]},
                            {"$set": {
                                "quantity": new_qty,
                                "is_low_stock": new_qty <= inv_item["min_quantity"]
                            }}
                        )
        except Exception as e:
            logger.error(f"Inventory restock failed: {e}")
    asyncio.create_task(_run())


async def _get_next_order_number(restaurant_id: str) -> str:
    """Atomic per-restaurant-per-day order number (no duplicates under load).

    Uses a MongoDB counters collection with find_one_and_update($inc) —
    replaces the old count_documents() approach that raced.
    """
    today = datetime.now(RESTAURANT_TZ).strftime("%Y%m%d")
    key = f"{restaurant_id}:{today}"
    doc = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"{today}{doc['seq']:04d}"


def _validate_order_transition(old_status: str, new_status: str):
    """Enforce the order lifecycle: received → preparing → ready → completed.

    Cancelled is allowed from any non-completed state. Invalid jumps and
    backwards moves are rejected so an order can never skip payment or
    "un-complete" itself.
    """
    ALLOWED = {
        "received": {"preparing", "cancelled"},
        "preparing": {"ready", "cancelled"},
        "ready": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    }
    if old_status == new_status:
        return  # idempotent no-op
    if new_status not in ALLOWED.get(old_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status change: cannot go from '{old_status}' to '{new_status}'"
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

def _send_email_sync(to_email: str, subject: str, html_body: str):
    # Preferred: SendGrid HTTPS API — works on Render free tier (SMTP port 587 is blocked)
    if SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            message = Mail(
                from_email=(SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME),
                to_emails=to_email,
                subject=subject,
                html_content=html_body
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            resp = sg.send(message)
            if resp.status_code not in (200, 201, 202):
                raise RuntimeError(f"SendGrid status {resp.status_code}")
            return
        except Exception as e:
            logger.error(f"SendGrid send failed: {e}")
            # fall through to SMTP fallback

    # Fallback: Gmail SMTP
    from email.mime.multipart import MIMEMultipart
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, [to_email], msg.as_string())

async def send_verification_email(email: str, name: str, token: str):
    """Send email verification link to newly registered user (SendGrid or SMTP)."""
    if not SENDGRID_API_KEY and (not GMAIL_USER or not GMAIL_APP_PASSWORD):
        logger.warning("Email not configured (no SendGrid key or SMTP creds) — skipping verification email")
        return
    verify_link = f"{FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your DineDesk account"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:#111;padding:32px;text-align:center;">
          <h1 style="color:#fff;font-size:24px;margin:0;">🍽️ DineDesk</h1>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Welcome, {name}!</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">Thanks for signing up for DineDesk. Please verify your email address to activate your account.</p>
          <a href="{verify_link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:14px;">Verify Email Address</a>
          <p style="color:#999;font-size:12px;margin:24px 0 0;line-height:1.5;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    """
    try:
        await asyncio.to_thread(_send_email_sync, email, subject, html_body)
        logger.info(f"Verification email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send verification email: {e}")

async def send_password_reset_email(email: str, name: str, token: str):
    """Send password reset link to user (SendGrid or SMTP)."""
    if not SENDGRID_API_KEY and (not GMAIL_USER or not GMAIL_APP_PASSWORD):
        logger.warning("Email not configured (no SendGrid key or SMTP creds) — skipping password reset email")
        return
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your DineDesk password"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:#111;padding:32px;text-align:center;">
          <h1 style="color:#fff;font-size:24px;margin:0;">🍽️ DineDesk</h1>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Reset your password</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">Hi {name}, we received a request to reset your password. Click the button below to choose a new one.</p>
          <a href="{reset_link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:14px;">Reset Password</a>
          <p style="color:#999;font-size:12px;margin:24px 0 0;line-height:1.5;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    """
    try:
        await asyncio.to_thread(_send_email_sync, email, subject, html_body)
        logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")

# ============== OTP STORAGE & SMS ==============
# In-memory OTP store: {phone: {otp, expires_at, attempts}}
_otp_store: Dict[str, Dict[str, Any]] = {}

import random

def _generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return f"{random.randint(100000, 999999)}"

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via Twilio SMS."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        logger.warning(f"Twilio not configured — OTP for {phone}: {otp}")
        return True  # Still allow flow to continue (mock mode)
    try:
        from twilio.rest import Client as TwilioClient
        client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=f"Your DineDesk verification code is: {otp}. Valid for 5 minutes. Do not share this code.",
            from_=TWILIO_PHONE_NUMBER,
            to=phone
        )
        logger.info(f"OTP sent to {phone}, SID: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP to {phone}: {e}")
        return False

async def send_otp_email(email: str, name: str, otp: str):
    """Send OTP via email (SendGrid) when Twilio SMS is unavailable."""
    subject = "Your DineDesk verification code"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:#111;padding:32px;text-align:center;">
          <h1 style="color:#fff;font-size:24px;margin:0;">🍽️ DineDesk</h1>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Hi {name}!</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">Your DineDesk phone verification code is:</p>
          <div style="background:#f5f5f5;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111;">{otp}</span>
          </div>
          <p style="color:#999;font-size:12px;margin:0;line-height:1.5;">This code is valid for 5 minutes. Do not share it with anyone.</p>
        </div>
      </div>
    </body>
    </html>
    """
    try:
        await asyncio.to_thread(_send_email_sync, email, subject, html_body)
        logger.info(f"OTP email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")
        return False


# ============== AI INSIGHTS ==============

async def generate_ai_insights(analytics_data: dict, restaurant_name: str = "Restaurant", report_type: str = "daily") -> str:
    """Generate AI-powered insights using Google Gemini."""
    if not GEMINI_API_KEY or not GEMINI_AVAILABLE:
        return "AI insights require Gemini API key. Add GEMINI_API_KEY to your environment variables."
    
    try:
        # Build context from analytics data
        daily_sales = analytics_data.get("daily_sales", 0)
        total_orders = analytics_data.get("total_orders", 0)
        avg_order = daily_sales / total_orders if total_orders > 0 else 0
        top_items = analytics_data.get("top_items", [])
        order_types = analytics_data.get("order_type_breakdown", {})
        hourly = analytics_data.get("hourly_orders", [])
        payments = analytics_data.get("payment_breakdown", {})
        weekly_sales = analytics_data.get("weekly_sales", 0)
        monthly_sales = analytics_data.get("monthly_sales", 0)
        
        # Format top items (avoid nested quotes in f-strings)
        items_lines = []
        for item in top_items[:10]:
            item_name = item.get("name", "Unknown")
            item_count = item.get("count", 0)
            items_lines.append("  - %s: %s sold" % (item_name, item_count))
        items_text = "\n".join(items_lines) if items_lines else "  No items sold today"
        
        # Format hourly data (only non-zero)
        peak_hours = [h for h in hourly if h.get("orders", 0) > 0] if hourly else []
        peak_lines = []
        for h in peak_hours[:8]:
            hour = h.get("hour", "?")
            orders = h.get("orders", 0)
            revenue = h.get("revenue", 0)
            peak_lines.append("  - %s:00 -> %s orders, Rs.%.0f" % (hour, orders, revenue))
        peak_text = "\n".join(peak_lines) if peak_lines else "  No hourly data"
        
        # Format order types
        types_lines = []
        for k, v in order_types.items():
            type_name = k.replace("_", " ").title()
            types_lines.append("  - %s: %s" % (type_name, v))
        types_text = "\n".join(types_lines) if types_lines else "  No data"
        
        # Format payments
        pay_lines = []
        for k, v in payments.items():
            pay_lines.append("  - %s: Rs.%.0f" % (k.upper(), v))
        pay_text = "\n".join(pay_lines) if pay_lines else "  No data"
        
        # Build the prompt
        data_summary = (
            "Restaurant: %s\n"
            "Report Period: Today (%s)\n"
            "\n"
            "SALES SUMMARY:\n"
            "- Daily Sales: Rs.%,.2f\n"
            "- Weekly Sales: Rs.%,.2f\n"
            "- Monthly Sales: Rs.%,.2f\n"
            "- Total Orders: %s\n"
            "- Average Order Value: Rs.%,.2f\n"
            "\n"
            "TOP SELLING ITEMS:\n"
            "%s\n"
            "\n"
            "ORDER TYPES:\n"
            "%s\n"
            "\n"
            "PEAK HOURS:\n"
            "%s\n"
            "\n"
            "PAYMENT METHODS:\n"
            "%s"
        ) % (
            restaurant_name,
            analytics_data.get("selected_date", ""),
            daily_sales, weekly_sales, monthly_sales,
            total_orders, avg_order,
            items_text, types_text, peak_text, pay_text
        )
        
        system_prompt = (
            "You are DineDesk AI, an expert restaurant business analyst powered by advanced analytics. "
            "You analyze %s's sales data and provide actionable, specific insights that help the restaurant owner make better business decisions.\n"
            "\n"
            "Your insights must be:\n"
            "1. SPECIFIC — Reference exact numbers, percentages, and item names from the data\n"
            "2. ACTIONABLE — Give concrete steps the owner can take TODAY or THIS WEEK\n"
            "3. PROFESSIONAL — Use clean markdown formatting with headers and bullet points\n"
            "4. INSIGHTFUL — Find patterns the owner might miss (correlations, trends, opportunities)\n"
            "5. CONCISE — Keep total response under 400 words\n"
            "\n"
            "Format your response as:\n"
            "## Sales Performance Summary\n"
            "[Brief 2-3 sentence overview with key numbers]\n"
            "\n"
            "## Top Performers\n"
            "[Highlight best items with percentages and why they matter]\n"
            "\n"
            "## Peak Hours Analysis\n"
            "[When busiest, staffing implications]\n"
            "\n"
            "## Recommendations\n"
            "[3-5 specific, numbered actionable items with expected impact]\n"
            "\n"
            "## Tomorrow's Prep\n"
            "[Specific prep suggestions based on today's patterns]"
        ) % restaurant_name

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt
        )
        
        prompt_text = "Analyze today's restaurant performance and provide insights:\n\n%s" % data_summary
        response = model.generate_content(prompt_text)
        
        return response.text
        
    except Exception as e:
        logger.error(f"AI insights generation failed: {e}")
        return f"AI insights temporarily unavailable. Error: {str(e)[:100]}"


# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    if not _check_rate_limit(f"register:{user_data.email}", 5):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    needs_email_verification = EMAIL_VERIFICATION_REQUIRED and EMAIL_CONFIGURED

    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "phone": user_data.phone,
        "phone_verified": False,
        "role": "owner",
        "restaurant_id": None,
        "branch_id": None,
        "onboarding_complete": False,
        "is_verified": not needs_email_verification,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if needs_email_verification:
        user["verification_token"] = str(uuid.uuid4())
        user["verification_token_expires"] = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    await db.users.insert_one(user)
    await log_action("auth", "user_registered", user_id=user_id)

    if needs_email_verification:
        # SaaS mode: send verification link in background (never blocks the response)
        asyncio.create_task(send_verification_email(user_data.email, user_data.name, user["verification_token"]))
        return RegisterResponse(
            message="Registration successful! We've sent a verification link to your email. "
                    "Please verify your email to activate your account, then log in.",
            email=user_data.email
        )

    # Dev/self-host mode: account auto-verified — log the user straight in
    token = create_token(user_id, user["role"], None)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user_id, email=user["email"], name=user["name"], role=user["role"],
                          restaurant_id=None, branch_id=None, created_at=user["created_at"])
    )

@api_router.post("/auth/verify-email", response_model=TokenResponse)
async def verify_email(data: VerifyEmailRequest):
    user = await db.users.find_one({"verification_token": data.token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    expires = user.get("verification_token_expires")
    if expires:
        try:
            if datetime.fromisoformat(expires) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new one.")
        except HTTPException:
            raise
        except Exception:
            pass

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_verified": True}, "$unset": {"verification_token": "", "verification_token_expires": ""}}
    )
    await log_action("auth", "email_verified", user_id=user["id"])

    token = create_token(user["id"], user["role"], user.get("restaurant_id"))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"],
                          restaurant_id=user.get("restaurant_id"), branch_id=user.get("branch_id"),
                          created_at=user["created_at"])
    )

@api_router.post("/auth/resend-verification")
async def resend_verification(data: ResendVerificationRequest):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        return {"message": "If that email is registered, a verification link has been sent."}
    if user.get("is_verified"):
        return {"message": "This account is already verified. Please log in."}

    verification_token = str(uuid.uuid4())
    verification_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"verification_token": verification_token, "verification_token_expires": verification_expires}}
    )
    asyncio.create_task(send_verification_email(user["email"], user["name"], verification_token))
    return {"message": "Verification email sent. Please check your inbox."}

@api_router.post("/auth/send-otp")
async def send_otp(data: SendOTPRequest):
    """Send a 6-digit OTP to the given phone number via SMS."""
    phone = data.phone.strip()
    if not phone.startswith("+") or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number with country code (e.g. +919876543210)")

    if not _check_rate_limit(f"otp:{phone}", 3):
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please try again after 1 minute.")

    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    _otp_store[phone] = {
        "otp": otp,
        "expires_at": expires_at,
        "attempts": 0
    }

    sent = await send_sms_otp(phone, otp)
    if not sent and TWILIO_ACCOUNT_SID:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

    # If Twilio is not configured, try email fallback (SendGrid)
    if not TWILIO_ACCOUNT_SID:
        user = await db.users.find_one({"phone": phone}, {"_id": 0})
        if user and user.get("email"):
            asyncio.create_task(send_otp_email(user["email"], user.get("name", "there"), otp))
            return {"message": "OTP sent to your email", "expires_in": 300}
        logger.info(f"[DEV MODE] OTP for {phone}: {otp}")

    return {"message": "OTP sent successfully", "expires_in": 300}

@api_router.post("/auth/verify-otp")
async def verify_otp(data: VerifyOTPRequest):
    """Verify the OTP sent to the given phone number."""
    phone = data.phone.strip()
    otp = data.otp.strip()

    stored = _otp_store.get(phone)
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP found for this number. Please request a new one.")

    if datetime.now(timezone.utc) > stored["expires_at"]:
        _otp_store.pop(phone, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    stored["attempts"] += 1
    if stored["attempts"] > 5:
        _otp_store.pop(phone, None)
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")

    if stored["otp"] != otp:
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {5 - stored['attempts']} attempts remaining.")

    # OTP verified — remove from store
    _otp_store.pop(phone, None)
    return {"message": "Phone number verified successfully", "verified": True}

@api_router.post("/auth/google", response_model=TokenResponse)
async def google_login(data: GoogleLoginRequest):
    """Login or register using a Google ID token."""
    import requests as http_requests
    try:
        # Verify the ID token with Google's tokeninfo endpoint
        resp = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": data.credential},
            timeout=10
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        
        google_data = resp.json()
        google_email = google_data.get("email")
        google_name = google_data.get("name", "")
        google_picture = google_data.get("picture", "")
        
        if not google_email:
            raise HTTPException(status_code=401, detail="Google token missing email")
        
        # Find existing user by email
        user = await db.users.find_one({"email": google_email}, {"_id": 0})
        
        if user:
            # Existing user — update profile pic if not set
            if not user.get("profile_picture") and google_picture:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"profile_picture": google_picture}}
                )
                user["profile_picture"] = google_picture
            # Ensure account is verified
            if not user.get("is_verified"):
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"is_verified": True}}
                )
                user["is_verified"] = True
        else:
            # New user — create account
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": google_email,
                "password": hash_password(uuid.uuid4().hex),  # Random password
                "name": google_name,
                "phone": None,
                "phone_verified": True,  # Google accounts are verified
                "role": "owner",
                "restaurant_id": None,
                "branch_id": None,
                "onboarding_complete": False,
                "is_verified": True,  # Google accounts are pre-verified
                "profile_picture": google_picture,
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            await log_action("auth", "google_register", user_id=user_id)
        
        # Generate JWT
        token = create_token(user["id"], user["role"], user.get("restaurant_id"))
        await log_action("auth", "google_login", user_id=user["id"])
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user["id"], email=user["email"], name=user["name"],
                role=user["role"], restaurant_id=user.get("restaurant_id"),
                branch_id=user.get("branch_id"), created_at=user["created_at"]
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth failed: {e}")
        raise HTTPException(status_code=500, detail="Google authentication failed")

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send a password reset link to the given email."""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If that email is registered, a password reset link has been sent."}

    # Rate limit: max 3 reset requests per hour per email
    if not _check_rate_limit(f"reset:{data.email}", 3):
        raise HTTPException(status_code=429, detail="Too many reset requests. Please try again later.")

    reset_token = str(uuid.uuid4())
    reset_expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"reset_token": reset_token, "reset_token_expires": reset_expires}}
    )
    asyncio.create_task(send_password_reset_email(user["email"], user["name"], reset_token))
    return {"message": "If that email is registered, a password reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using the token from the email link."""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = await db.users.find_one({"reset_token": data.token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    expires = user.get("reset_token_expires")
    if expires:
        try:
            if datetime.fromisoformat(expires) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
        except HTTPException:
            raise
        except Exception:
            pass

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": hash_password(data.new_password)}, "$unset": {"reset_token": "", "reset_token_expires": ""}}
    )
    await log_action("auth", "password_reset", user_id=user["id"])
    return {"message": "Password reset successful. You can now log in with your new password."}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    if not _check_rate_limit(f"login:{credentials.email}", 10):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Enforce email verification ONLY when the SaaS email flow is enabled.
    # Dev/self-host default: accounts are auto-verified, so existing unverified
    # rows are never locked out of login.
    if EMAIL_VERIFICATION_REQUIRED and EMAIL_CONFIGURED and not user.get("is_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Email not verified yet. We've sent a verification link to your email — "
                   "please click it to activate your account, or request a new link below."
        )

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
        "tax_rate": data.tax_rate,
        "fssai_license_number": data.fssai_license_number.strip(),
        "fssai_expiry_date": data.fssai_expiry_date,
        "fssai_verified": validate_fssai_format(data.fssai_license_number),
        "fssai_verified_at": datetime.now(timezone.utc).isoformat() if validate_fssai_format(data.fssai_license_number) else None,
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


# ---- FSSAI food license helpers ----

def validate_fssai_format(license_number: str) -> bool:
    """Validate FSSAI license number format: 14 digits, first digit is the
    Indian state/UT code (1-9 per FSSAI state code list)."""
    if not license_number:
        return False
    return bool(re.fullmatch(r"[1-9]\d{13}", license_number.strip()))

async def check_license_expiry(restaurant: dict):
    """Create an in-app notification 30/15/7 days before, and on the day of,
    the restaurant's FSSAI license expiry. Runs once per day per restaurant
    per milestone (keyed on license_alert:<days_left>:<date>)."""
    expiry = restaurant.get("fssai_expiry_date")
    if not expiry:
        return
    try:
        exp_date = datetime.fromisoformat(str(expiry)[:10]).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return
    now = datetime.now(timezone.utc)
    days_left = (exp_date - now).days
    if days_left > 30 or days_left < 0:
        return
    milestone = 0 if days_left == 0 else min(d for d in (30, 15, 7, 1) if days_left <= d)
    dedupe_key = f"license_alert:{milestone}:{now.strftime('%Y-%m-%d')}"
    already = await db.notifications.find_one({"restaurant_id": restaurant["id"], "type": "license_alert", "message": {"$regex": f"^{re.escape(dedupe_key)}"}})
    if already:
        return
    if days_left == 0:
        title = f"Your FSSAI license {restaurant.get('fssai_license_number', '')} expires TODAY"
    else:
        title = f"FSSAI license expires in {days_left} day{'s' if days_left != 1 else ''}"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "restaurant_id": restaurant["id"],
        "type": "license_alert",
        "message": f"{dedupe_key}|{title}. Renew it on the FSSAI portal before expiry to stay compliant.",
        "channel": "system",
        "status": "info",
        "created_at": now.isoformat(),
    })

# ---- Decentro FSSAI registry client (shared by manual verify + monthly loop) ----

def _decentro_credentials():
    return (
        os.environ.get("DECENTRO_CLIENT_ID", ""),
        os.environ.get("DECENTRO_CLIENT_SECRET", ""),
        os.environ.get("DECENTRO_MODULE_SECRET", ""),
        os.environ.get("DECENTRO_BASE_URL", "https://in.staging.decentro.tech"),
    )

def _decentro_fssai_lookup(license_number: str):
    """Blocking call to Decentro's FSSAI registry lookup. Returns the parsed
    payload dict, or raises on network/HTTP failure. Caller must run it in a
    worker thread (asyncio.to_thread)."""
    import requests as _requests
    client_id, client_secret, module_secret, base_url = _decentro_credentials()
    resp = _requests.post(
        f"{base_url}/kyc/public_registry/validate",
        headers={
            "client_id": client_id,
            "client_secret": client_secret,
            "module_secret": module_secret,
            "Content-Type": "application/json",
        },
        json={
            "reference_id": f"dinedesk-{uuid.uuid4().hex[:12]}",
            "document_type": "FSSAI",
            "id_number": license_number,
            "consent": "Y",
            "consent_purpose": "DineDesk FSSAI license verification",
        },
        timeout=30,
    )
    return resp.json()

async def fssai_registry_check(license_number: str) -> dict:
    """Query the official FSSAI registry via Decentro without blocking the
    event loop. Returns one of:
      {outcome: 'verified'|'not_found'|'invalid_format'|'unreachable', ...}.
    Never fabricates a registry result."""
    try:
        payload = await asyncio.to_thread(_decentro_fssai_lookup, license_number)
    except Exception as e:
        logger.warning(f"Decentro FSSAI lookup unreachable: {str(e)[:150]}")
        return {"outcome": "unreachable", "message": "Government registry could not be reached right now."}
    kyc_status = (payload.get("kycStatus") or "").upper()
    result = payload.get("kycResult") or {}
    error_msg = (payload.get("error") or {}).get("message") or payload.get("message") or ""
    if kyc_status == "SUCCESS":
        reg_status = (result.get("status") or "UNKNOWN").upper()
        return {
            "outcome": "verified",
            "registry_status": reg_status,
            "entity_name": result.get("entityName") or "",
            "license_type": result.get("licenseType"),
            "premises_address": (result.get("premissesAddress") or {}).get("address"),
        }
    if "No records found" in error_msg:
        return {"outcome": "not_found", "message": "This license number was not found in the FSSAI registry."}
    if "Invalid FSSAI" in error_msg or "14 digit" in error_msg:
        return {"outcome": "invalid_format", "message": "FSSAI rejected this number — it must be a valid 14-digit license/registration number."}
    logger.warning(f"Decentro FSSAI lookup failed: {payload.get('responseKey')} {error_msg[:120]}")
    return {"outcome": "unreachable", "message": error_msg[:150] or "Registry lookup failed."}

@api_router.post("/restaurants/verify-license")
async def verify_fssai_license(data: dict, user: dict = Depends(get_current_user)):
    """Verify a FSSAI food license number against the official government
    registry via Decentro (https://decentro.tech), falling back to a honest
    format-level check when the provider is unreachable. Never returns a
    fake success."""
    license_number = str(data.get("license_number", "")).strip()
    if not validate_fssai_format(license_number):
        return {"valid": False, "status": "invalid_format", "message": "FSSAI license must be a 14-digit number starting with a valid state code (1-9)."}

    client_id, client_secret, module_secret, _base = _decentro_credentials()
    if client_id and client_secret and module_secret:
        check = await fssai_registry_check(license_number)
        if check["outcome"] == "verified":
            reg_status = check["registry_status"]
            entity = check.get("entity_name") or ""
            lic_type = (check.get("license_type") or "")
            lic_type_title = lic_type.title() if lic_type else ""
            msg = f"Verification successful — license is {reg_status} in the FSSAI registry"
            if entity:
                msg += f" for {entity}"
            if lic_type_title:
                msg += f" ({lic_type_title})"
            msg += "."
            # Persist the registry result so the details page shows the last
            # official check even after the visitor leaves.
            if user.get("restaurant_id"):
                try:
                    await db.restaurants.update_one(
                        {"id": user["restaurant_id"]},
                        {"$set": {
                            "fssai_registry_status": reg_status,
                            "fssai_registry_entity": entity,
                            "fssai_registry_type": lic_type,
                            "fssai_registry_premises": check.get("premises_address"),
                            "fssai_registry_checked_at": datetime.now(timezone.utc).isoformat(),
                            "fssai_verified": reg_status == "ACTIVE",
                            "fssai_verified_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                except Exception as _e:
                    logger.warning(f"Failed to persist FSSAI registry result: {_e}")
            return {
                "valid": reg_status == "ACTIVE",
                "status": "verified",
                "registry_status": reg_status,
                "entity_name": entity,
                "license_type": lic_type,
                "premises_address": check.get("premises_address"),
                "message": msg if reg_status == "ACTIVE" else f"License found but status is {reg_status} — not active. Please renew or correct the number.",
            }
        if check["outcome"] == "not_found":
            return {"valid": False, "status": "not_found", "message": "This license number was not found in the FSSAI registry. Double-check the 14-digit number on your certificate."}
        if check["outcome"] == "invalid_format":
            return {"valid": False, "status": "invalid_format", "message": "FSSAI rejected this number — it must be a valid 14-digit license/registration number."}
        # unreachable → fall through to honest format-level fallback

    # Fallback: format-level check only, stated honestly.
    configured = bool(client_id and client_secret and module_secret)
    return {
        "valid": True,
        "status": "format_verified",
        "provider_configured": configured,
        "message": "Verification successful — valid FSSAI format (state code + 14 digits). " + (
            "Government registry could not be reached right now; we'll re-verify automatically." if configured
            else "Full registry verification is being activated shortly."
        ),
    }

@api_router.post("/restaurants/reverify-licenses")
async def reverify_all_licenses(user: dict = Depends(get_current_user)):
    """Manual trigger for the monthly re-verification sweep. Owner/admin only.
    Runs the same checks as the scheduled loop and returns what changed."""
    check_role(user, "settings")
    summary = await run_license_reverification(force=True)
    return {"message": "Re-verification complete", **summary}

async def run_license_reverification(force: bool = False) -> dict:
    """Re-verify every restaurant's FSSAI license against the registry and:
      - store the fresh registry snapshot (status, entity, premises, time)
      - raise an in-app alert the first time a license turns inactive or
        disappears from the registry (never duplicated per status+day)
      - stay silent on transient provider outages (no false alarms)
    Licenses are re-checked at most once every 30 days unless force=True.
    Returns a small summary dict for logging/monitoring."""
    summary = {"checked": 0, "still_active": 0, "went_inactive": 0, "not_found": 0, "skipped": 0, "unreachable": 0}
    client_id, client_secret, module_secret, _base = _decentro_credentials()
    if not (client_id and client_secret and module_secret):
        logger.info("License re-verification skipped: Decentro not configured")
        return summary
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=30)).isoformat()
    query = {"fssai_license_number": {"$exists": True, "$nin": [None, ""]}}
    if not force:
        query["$or"] = [
            {"fssai_registry_checked_at": {"$exists": False}},
            {"fssai_registry_checked_at": None},
            {"fssai_registry_checked_at": {"$lt": cutoff}},
        ]
    restaurants = await db.restaurants.find(query, {"_id": 0}).to_list(500)
    for restaurant in restaurants:
        license_number = restaurant.get("fssai_license_number", "").strip()
        if not validate_fssai_format(license_number):
            summary["skipped"] += 1
            continue
        summary["checked"] += 1
        check = await fssai_registry_check(license_number)
        outcome = check.get("outcome")
        if outcome == "unreachable":
            # Transient provider problem — not a compliance signal. Never alert.
            summary["unreachable"] += 1
            continue
        reg_status = (check.get("registry_status") or "").upper() if outcome == "verified" else ""
        update_set = {
            "fssai_registry_checked_at": now.isoformat(),
        }
        if outcome == "verified":
            update_set.update({
                "fssai_registry_status": reg_status,
                "fssai_registry_entity": check.get("entity_name") or "",
                "fssai_registry_type": check.get("license_type"),
                "fssai_registry_premises": check.get("premises_address"),
                "fssai_verified": reg_status == "ACTIVE",
                "fssai_verified_at": now.isoformat(),
            })
        elif outcome == "not_found":
            update_set.update({
                "fssai_registry_status": "NOT_FOUND",
                "fssai_verified": False,
            })
        await db.restaurants.update_one({"id": restaurant["id"]}, {"$set": update_set})

        # Compliance alert only on genuine registry state:
        # ACTIVE → healthy (clears any previous inactive flag internally).
        active = outcome == "verified" and reg_status == "ACTIVE"
        if active:
            summary["still_active"] += 1
            continue
        went_inactive = outcome == "verified" and reg_status != "ACTIVE"
        if went_inactive:
            summary["went_inactive"] += 1
            alert_title = f"FSSAI license {license_number} is now {reg_status} in the government registry"
            alert_body = (
                f"{alert_title}. Your license was active earlier but the registry now reports "
                f"{reg_status}. Renew it on the FoSCoS portal to stay compliant."
            )
        else:
            summary["not_found"] += 1
            alert_title = f"FSSAI license {license_number} not found in the government registry"
            alert_body = (
                f"{alert_title}. During DineDesk's monthly compliance check the registry returned "
                f"no record for this number. Verify the number on your certificate and update it "
                f"in Restaurant Details."
            )
        dedupe_key = f"license_status:{outcome}:{reg_status or 'NOT_FOUND'}:{now.strftime('%Y-%m')}"
        already = await db.notifications.find_one({
            "restaurant_id": restaurant["id"],
            "type": "license_alert",
            "message": {"$regex": f"^{re.escape(dedupe_key)}"},
        })
        if not already:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "restaurant_id": restaurant["id"],
                "type": "license_alert",
                "message": f"{dedupe_key}|{alert_body}",
                "channel": "system",
                "status": "warning",
                "created_at": now.isoformat(),
            })
        logger.warning(f"License compliance alert [{restaurant.get('name', restaurant['id'])}]: {alert_title}")
    return summary

async def license_reverification_loop():
    """Background loop: runs the re-verification sweep once a day. The sweep
    itself rate-limits each restaurant to one registry check per 30 days, so
    this gives 'monthly re-verification' with daily retry safety if a sweep
    was interrupted or the provider was down."""
    while True:
        try:
            await asyncio.sleep(3600)  # first sweep 1h after boot, then daily
            summary = await run_license_reverification()
            if summary.get("checked"):
                logger.info(f"License re-verification sweep: {summary}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"License re-verification loop error: {e}")
            await asyncio.sleep(3600)

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

@api_router.post("/branches")
async def create_branch(data: BranchCreate, user: dict = Depends(get_current_user)):
    check_role(user, "branches")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    if not data.login_email or not data.login_password:
        raise HTTPException(status_code=400, detail="Login email and password are required for branch")
    if len(data.login_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing_user = await db.users.find_one({"email": data.login_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

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
        "login_email": data.login_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.branches.insert_one(branch)

    branch_user_id = str(uuid.uuid4())
    branch_user = {
        "id": branch_user_id,
        "email": data.login_email,
        "password": hash_password(data.login_password),
        "name": f"{data.name} Manager",
        "role": "manager",
        "restaurant_id": user["restaurant_id"],
        "branch_id": branch_id,
        "is_active": True,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(branch_user)

    result = {k: v for k, v in branch.items() if k not in ["_id", "login_email"]}
    return BranchResponse(**result)

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
async def get_menu_items(category_id: Optional[str] = None,
                         skip: int = 0, limit: int = 500, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if category_id:
        query["category_id"] = category_id
    limit = min(limit, 1000)
    items = await db.menu_items.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
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
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max size is {MAX_UPLOAD_SIZE_MB}MB")
    file_id = str(uuid.uuid4())
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    # Whitelist allowed extensions
    allowed_exts = {"jpg", "jpeg", "png", "gif", "webp", "svg"}
    if file_ext.lower() not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File type '.{file_ext}' not allowed. Use: {', '.join(allowed_exts)}")
    file_name = f"{file_id}.{file_ext}"
    file_path = UPLOAD_DIR / file_name
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
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
    restaurant_doc = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    if restaurant_doc:
        try:
            await check_license_expiry(restaurant_doc)
        except Exception as _e:
            logger.warning(f"License expiry check failed: {_e}")
    await log_action("day_session", "day_opened", user_id=user["id"], restaurant_id=user["restaurant_id"])
    return DaySessionResponse(**{k: v for k, v in session.items() if k not in ["_id", "opened_by"]})

@api_router.post("/day-session/close", response_model=DaySessionResponse)
async def close_day(closing_cash: float = 0, force: bool = False, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="No open day session")

    # Guard: don't close the day while orders are still running or unpaid —
    # those sales would silently vanish from the day report. force=true overrides
    # deliberately (e.g. emergency close).
    if not force:
        open_orders = await db.orders.count_documents({
            "day_session_id": session["id"],
            "status": {"$nin": ["completed", "cancelled"]}
        })
        unpaid_orders = await db.orders.count_documents({
            "day_session_id": session["id"],
            "payment_status": {"$ne": "paid"},
            "status": {"$ne": "cancelled"}
        })
        if open_orders or unpaid_orders:
            parts = []
            if open_orders:
                parts.append(f"{open_orders} running order(s)")
            if unpaid_orders:
                parts.append(f"{unpaid_orders} unpaid order(s)")
            raise HTTPException(
                status_code=400,
                detail=f"Cannot close the day: {', '.join(parts)} still open. Complete or cancel them first, or close with force."
            )

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

    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    tax_rate = float(restaurant.get("tax_rate", 5.0)) if restaurant else 5.0

    if not data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    if data.discount_amount < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")

    order_number = await _get_next_order_number(user["restaurant_id"])

    order_items = []
    subtotal = 0
    for item_data in data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id, "restaurant_id": user["restaurant_id"]}, {"_id": 0})
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item '{item_data.menu_item_id}' not found")
        if not menu_item.get("is_available", True):
            raise HTTPException(status_code=400, detail=f"'{menu_item['name']}' is currently unavailable")
        if item_data.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity for '{menu_item['name']}' must be at least 1")
        item_total = round(menu_item["price"] * item_data.quantity, 2)
        subtotal += item_total
        order_items.append({
            "menu_item_id": item_data.menu_item_id,
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": item_data.quantity,
            "notes": item_data.notes,
            "total": item_total
        })

    if data.discount_amount > subtotal:
        raise HTTPException(status_code=400, detail=f"Discount (₹{data.discount_amount}) cannot exceed the order subtotal (₹{subtotal})")

    tax_amount = round(subtotal * tax_rate / 100, 2)
    total_amount = round(subtotal + tax_amount - data.discount_amount, 2)

    # Validate payment data up-front so a bad payment never creates a broken order
    is_pending_payment = data.payment_method == "pending"
    payment_splits_data = []
    actual_method = data.payment_method
    change_amt = data.change_amount or 0
    if not is_pending_payment:
        if data.payment_splits:
            if len(data.payment_splits) > 1:
                split_sum = round(sum(s.amount for s in data.payment_splits), 2)
                if abs(split_sum - total_amount) > 1.0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Split payments (₹{split_sum}) must add up to the order total (₹{total_amount})"
                    )
                for split in data.payment_splits:
                    if split.amount <= 0:
                        raise HTTPException(status_code=400, detail="Split amounts must be positive")
                    payment_splits_data.append({"method": split.method, "amount": split.amount})
                actual_method = "split"
            else:
                actual_method = data.payment_splits[0].method
                payment_splits_data = [{"method": actual_method, "amount": round(total_amount, 2)}]
        if data.payment_method == "cash" and change_amt > 0 and change_amt >= total_amount and not data.payment_splits:
            raise HTTPException(status_code=400, detail="Change amount cannot be greater than or equal to cash tendered total — check the amount paid")
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": user["restaurant_id"],
        "branch_id": user.get("branch_id"),
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
        "payment_method": actual_method if not is_pending_payment else data.payment_method,
        "payment_status": "pending" if is_pending_payment else "paid",
        "status": "received",
        "platform": data.platform,
        "day_session_id": session["id"],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)

    if data.order_type == "dine_in" and data.table_number:
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": data.table_number},
            {"$set": {"status": "occupied", "current_order_id": order_id}}
        )

    await deduct_inventory(user["restaurant_id"], [{"menu_item_id": i.menu_item_id, "quantity": i.quantity} for i in data.items])

    if not is_pending_payment:
        # Record wallet entries for validated payment(s)
        if len(payment_splits_data) > 1:
            for split in payment_splits_data:
                await record_wallet_transaction(user["restaurant_id"], "sale", split["amount"], split["method"], order_id, session["id"])
        else:
            await record_wallet_transaction(user["restaurant_id"], "sale", total_amount, actual_method, order_id, session["id"])

        # Persist split/change details on the order
        if payment_splits_data:
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"payment_splits": payment_splits_data, "change_amount": change_amt}}
            )
            order["payment_splits"] = payment_splits_data
            order["change_amount"] = change_amt

        try:
            settings = await db.notification_settings.find_one({"restaurant_id": user["restaurant_id"]})
            if not settings or settings.get("sms_enabled", True):
                restaurant_for_notify = restaurant or await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
                asyncio.create_task(send_order_notification(order, restaurant_for_notify))
        except Exception as e:
            logger.error(f"Notification trigger error: {e}")

    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "created_by"]})

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(status: Optional[str] = None, order_type: Optional[str] = None,
                     skip: int = 0, limit: int = 100, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if status:
        query["status"] = status
    if order_type:
        query["order_type"] = order_type
    limit = min(limit, 500)  # cap at 500
    orders = await db.orders.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/today", response_model=List[OrderResponse])
async def get_today_orders(skip: int = 0, limit: int = 500, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    session = await db.day_sessions.find_one({"restaurant_id": user["restaurant_id"], "status": "open"}, {"_id": 0})
    if not session:
        return []
    limit = min(limit, 1000)
    orders = await db.orders.find({"day_session_id": session["id"]}, {"_id": 0, "created_by": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/running", response_model=List[OrderResponse])
async def get_running_orders(skip: int = 0, limit: int = 100, user: dict = Depends(get_current_user)):
    """Get orders that are not completed/cancelled (for table management)."""
    if not user.get("restaurant_id"):
        return []
    limit = min(limit, 500)
    orders = await db.orders.find({
        "restaurant_id": user["restaurant_id"],
        "status": {"$nin": ["completed", "cancelled"]},
        "order_type": "dine_in"
    }, {"_id": 0, "created_by": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [OrderResponse(**o) for o in orders]

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, data: OrderUpdate, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Enforce lifecycle: received → preparing → ready → completed (cancel only before completion)
    _validate_order_transition(order["status"], data.status)

    # Cannot complete an unpaid order — payment must go through /pay first
    if data.status == "completed" and order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Order must be paid before it can be completed")

    await db.orders.update_one({"id": order_id}, {"$set": {"status": data.status}})

    # Cancel: release table + restore inventory + log
    if data.status == "cancelled":
        if order["order_type"] == "dine_in" and order.get("table_number"):
            await db.tables.update_one(
                {"restaurant_id": user["restaurant_id"], "table_number": order["table_number"], "current_order_id": order_id},
                {"$set": {"status": "available", "current_order_id": None}}
            )
        if order.get("payment_status") == "paid":
            # Refund wallet entry so day reports stay correct
            await record_wallet_transaction(
                user["restaurant_id"], "refund", order["total_amount"],
                order.get("payment_method", "cash"), order_id, order.get("day_session_id")
            )
        _restock_inventory(user["restaurant_id"], order.get("items", []))
        await log_action("order", "order_cancelled", user_id=user["id"],
                         restaurant_id=user["restaurant_id"], details=f"Order {order['order_number']} cancelled")

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

    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot add items to a paid order")

    session = await db.day_sessions.find_one({"id": order.get("day_session_id"), "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="Day session is closed — cannot add items")

    if not data.items:
        raise HTTPException(status_code=400, detail="No items provided")

    restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
    tax_rate = float(restaurant.get("tax_rate", 5.0)) if restaurant else 5.0

    new_items = []
    for item_data in data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id, "restaurant_id": user["restaurant_id"]}, {"_id": 0})
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item '{item_data.menu_item_id}' not found")
        if not menu_item.get("is_available", True):
            raise HTTPException(status_code=400, detail=f"'{menu_item['name']}' is currently unavailable")
        if item_data.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity for '{menu_item['name']}' must be at least 1")
        item_total = round(menu_item["price"] * item_data.quantity, 2)
        new_items.append({
            "menu_item_id": item_data.menu_item_id,
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": item_data.quantity,
            "notes": item_data.notes,
            "total": item_total
        })

    all_items = order["items"] + new_items
    new_subtotal = round(sum(i["total"] for i in all_items), 2)
    if order["discount_amount"] > new_subtotal:
        raise HTTPException(status_code=400, detail="Discount exceeds the new order subtotal")
    tax_amount = round(new_subtotal * tax_rate / 100, 2)
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

    # Determine payment method and splits — validated before any wallet writes
    payment_method = data.payment_method or "cash"
    payment_splits = []
    change_amount = data.change_amount or 0

    if data.payment_splits:
        if len(data.payment_splits) > 1:
            split_sum = round(sum(s.amount for s in data.payment_splits), 2)
            if abs(split_sum - order["total_amount"]) > 1.0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Split payments (₹{split_sum}) must add up to the order total (₹{order['total_amount']})"
                )
            for split in data.payment_splits:
                if split.amount <= 0:
                    raise HTTPException(status_code=400, detail="Split amounts must be positive")
                payment_splits.append({"method": split.method, "amount": split.amount})
                await record_wallet_transaction(
                    user["restaurant_id"], "sale", split.amount,
                    split.method, order_id, order.get("day_session_id")
                )
            payment_method = "split"
        else:
            payment_method = data.payment_splits[0].method
            payment_splits = [{"method": payment_method, "amount": round(order["total_amount"], 2)}]
            await record_wallet_transaction(
                user["restaurant_id"], "sale", order["total_amount"],
                payment_method, order_id, order.get("day_session_id")
            )
    else:
        # Legacy single payment
        await record_wallet_transaction(
            user["restaurant_id"], "sale", order["total_amount"],
            payment_method, order_id, order.get("day_session_id")
        )

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_method": payment_method,
            "payment_status": "paid",
            "status": "completed",
            "payment_splits": payment_splits if payment_splits else None,
            "change_amount": change_amount,
        }}
    )

    if order["order_type"] == "dine_in" and order.get("table_number"):
        await db.tables.update_one(
            {"restaurant_id": user["restaurant_id"], "table_number": order["table_number"]},
            {"$set": {"status": "available", "current_order_id": None}}
        )

    try:
        settings = await db.notification_settings.find_one({"restaurant_id": user["restaurant_id"]})
        if not settings or settings.get("sms_enabled", True):
            restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
            updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
            asyncio.create_task(send_order_notification(updated_order, restaurant))
    except Exception as e:
        logger.error(f"Notification trigger error: {e}")

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

    order = await db.orders.find_one({"id": order_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # KDS may not skip backwards or revive completed/cancelled orders.
    # 'served' maps to the completed state's post-payment display, so allow it
    # only from 'ready' via the same lifecycle rules.
    target = "ready" if new_status == "served" else new_status
    _validate_order_transition(order["status"], target)

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
async def get_inventory(low_stock_only: bool = False,
                        skip: int = 0, limit: int = 500, user: dict = Depends(get_current_user)):
    check_role(user, "inventory")
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if low_stock_only:
        query["is_low_stock"] = True
    limit = min(limit, 1000)
    items = await db.inventory.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
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

    valid_roles = ["owner", "manager", "cashier", "captain", "chef"]
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
        "is_verified": True,
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
        {"restaurant_id": user["restaurant_id"], "role": {"$in": ["owner", "manager", "cashier", "captain", "chef"]}},
        {"_id": 0, "password": 0}
    ).to_list(100)
    result = []
    for s in staff:
        if "is_active" not in s:
            s["is_active"] = True
        data = {k: v for k, v in s.items() if k not in ["branch_id", "onboarding_complete"]}
        result.append(StaffResponse(**data))
    return result

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
async def get_wallet_summary(period: str = "today", date: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get wallet summary with payment method breakdown."""
    check_role(user, "wallet")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    now = datetime.now(timezone.utc)

    if date:
        try:
            selected = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except:
            selected = now
        start = selected.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        end = (selected.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    elif period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        end = None
    elif period == "week":
        start = (now - timedelta(days=7)).isoformat()
        end = None
    elif period == "month":
        start = (now - timedelta(days=30)).isoformat()
        end = None
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        end = None

    query = {"restaurant_id": user["restaurant_id"], "created_at": {"$gte": start}}
    if end:
        query["created_at"]["$lt"] = end

    txns = await db.wallet_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

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

@api_router.get("/analytics")
async def get_analytics(date: Optional[str] = None, branch_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    check_role(user, "analytics")
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")

    now_local = datetime.now(RESTAURANT_TZ)
    if date:
        try:
            # The chosen calendar day in restaurant-local time (00:00 IST → UTC window)
            selected_local = datetime.fromisoformat(date).replace(tzinfo=RESTAURANT_TZ)
        except:
            selected_local = now_local
        day_start = selected_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        day_end = (selected_local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).astimezone(timezone.utc)
    else:
        day_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        day_end = now_local.astimezone(timezone.utc)

    week_start = day_start - timedelta(days=7)
    month_start = day_start - timedelta(days=30)

    order_query = {"restaurant_id": user["restaurant_id"], "payment_status": "paid"}
    if branch_id and branch_id != "all":
        order_query["branch_id"] = branch_id

    all_orders = await db.orders.find(order_query, {"_id": 0}).to_list(10000)

    # Compare as datetimes (created_at is a UTC isoformat string) — string
    # comparisons against zone-aware isoformat strings break when offsets differ
    def _parse_created(o):
        try:
            return datetime.fromisoformat(o["created_at"])
        except Exception:
            return None

    day_orders = []
    weekly_sales = 0.0
    monthly_sales = 0.0
    daily_sales = 0.0
    for o in all_orders:
        created = _parse_created(o)
        if not created:
            continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if day_start <= created < day_end:
            day_orders.append(o)
            daily_sales += o["total_amount"]
        if created >= week_start:
            weekly_sales += o["total_amount"]
        if created >= month_start:
            monthly_sales += o["total_amount"]
    daily_sales = round(daily_sales, 2)
    weekly_sales = round(weekly_sales, 2)
    monthly_sales = round(monthly_sales, 2)

    item_counts = {}
    for order in day_orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + item.get("quantity", 1)
    top_items = sorted([{"name": k, "count": v} for k, v in item_counts.items()], key=lambda x: -x["count"])[:10]

    order_types = {}
    for order in day_orders:
        ot = order.get("order_type", "unknown")
        order_types[ot] = order_types.get(ot, 0) + 1

    # Peak hours bucketed in restaurant-local time (IST), not UTC — otherwise
    # every chart shifts by 5h30m and "3 PM rush" shows at 9 AM.
    hourly = {}
    for order in day_orders:
        try:
            created = datetime.fromisoformat(order["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            hour = created.astimezone(RESTAURANT_TZ).hour
            hourly[hour] = hourly.get(hour, 0) + 1
        except Exception:
            pass
    hourly_orders = [{"hour": h, "orders": c} for h, c in sorted(hourly.items())]

    payment_breakdown = {}
    for order in day_orders:
        pm = order.get("payment_method", "unknown")
        payment_breakdown[pm] = payment_breakdown.get(pm, 0) + order["total_amount"]

    return {
        "daily_sales": daily_sales, "weekly_sales": weekly_sales, "monthly_sales": monthly_sales,
        "total_orders": len(day_orders), "top_items": top_items, "order_type_breakdown": order_types,
        "hourly_orders": hourly_orders, "payment_breakdown": payment_breakdown,
        "selected_date": date or day_start.strftime("%Y-%m-%d")
    }

@api_router.post("/analytics/ai-insights")
async def get_ai_insights(user: dict = Depends(get_current_user)):
    """Generate AI-powered analytics insights using Gemini."""
    check_role(user, "analytics")
    try:
        # Get today's analytics data
        now = datetime.now(timezone.utc)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        restaurant_id = user.get("restaurant_id", "default")
        
        day_orders = await db.orders.find({
            "restaurant_id": restaurant_id,
            "created_at": {"$gte": day_start},
            "status": {"$in": ["completed", "paid"]}
        }).to_list(1000)
        
        daily_sales = sum(o.get("total_amount", 0) for o in day_orders)
        top_items_map = {}
        for o in day_orders:
            for item in o.get("items", []):
                name = item.get("name", "Unknown")
                top_items_map[name] = top_items_map.get(name, 0) + item.get("quantity", 1)
        top_items = [{"name": k, "count": v} for k, v in sorted(top_items_map.items(), key=lambda x: -x[1])[:10]]
        
        # Get restaurant name
        restaurant = await db.restaurants.find_one({"id": restaurant_id})
        restaurant_name = restaurant.get("name", "Restaurant") if restaurant else "Restaurant"
        
        # Weekly and monthly sales
        week_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_orders = await db.orders.find({"restaurant_id": restaurant_id, "created_at": {"$gte": week_start}, "status": {"$in": ["completed", "paid"]}}).to_list(10000)
        month_orders = await db.orders.find({"restaurant_id": restaurant_id, "created_at": {"$gte": month_start}, "status": {"$in": ["completed", "paid"]}}).to_list(10000)
        
        analytics_data = {
            "daily_sales": daily_sales,
            "weekly_sales": sum(o.get("total_amount", 0) for o in week_orders),
            "monthly_sales": sum(o.get("total_amount", 0) for o in month_orders),
            "total_orders": len(day_orders),
            "top_items": top_items,
            "selected_date": now.strftime("%Y-%m-%d")
        }
        
        insights = await generate_ai_insights(analytics_data, restaurant_name, "daily")
        return {"insights": insights, "data_summary": analytics_data}
    except Exception as e:
        logger.error(f"AI insights error: {e}")
        return {"insights": f"AI insights temporarily unavailable. Please try again later.", "data_summary": {}}

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

# ============== NOTIFICATIONS ==============

async def send_order_notification(order_data: dict, restaurant: dict):
    """Send SMS/WhatsApp notification to customer after order completion."""
    phone = order_data.get("customer_phone")
    name = order_data.get("customer_name", "Customer")
    if not phone:
        return

    clean_phone = phone.strip().replace(" ", "")
    if not clean_phone.startswith("+"):
        clean_phone = "+91" + clean_phone.lstrip("0")

    restaurant_name = restaurant.get("name", "Restaurant") if restaurant else "Restaurant"
    order_number = order_data.get("order_number", "N/A")
    total = order_data.get("total_amount", 0)
    items_text = ", ".join(f"{i.get('quantity',1)}x {i.get('name','')}" for i in order_data.get("items", [])[:5])

    message_body = (
        f"Hi {name}! Your order #{order_number} at {restaurant_name} is confirmed.\n"
        f"Items: {items_text}\n"
        f"Total: Rs.{total:.2f}\n"
        f"Payment: {order_data.get('payment_method', 'N/A').upper()}\n"
        f"Thank you for your order!"
    )

    notif_log = {
        "id": str(uuid.uuid4()),
        "restaurant_id": order_data.get("restaurant_id"),
        "order_id": order_data.get("id"),
        "order_number": order_number,
        "customer_name": name,
        "customer_phone": clean_phone,
        "message": message_body,
        "channel": "sms",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        notif_log["status"] = "demo"
        notif_log["channel"] = "demo"
        notif_log["whatsapp_status"] = "demo"
        logger.info(f"[DEMO] Notification logged for {clean_phone}: Order #{order_number}")
    except Exception as e:
        notif_log["status"] = "failed"
        notif_log["error"] = str(e)[:200]
        logger.error(f"SMS notification failed: {e}")

    await db.notifications.insert_one(notif_log)

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    """Get recent notification logs."""
    if not user.get("restaurant_id"):
        return []
    notifs = await db.notifications.find(
        {"restaurant_id": user["restaurant_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs

@api_router.post("/notifications/test")
async def send_test_notification(user: dict = Depends(get_current_user)):
    """Send a test SMS to verify Twilio setup."""
    test_order = {
        "id": "test",
        "restaurant_id": user.get("restaurant_id"),
        "customer_phone": TWILIO_PHONE_NUMBER,
        "customer_name": "Test User",
        "order_number": "TEST-001",
        "total_amount": 100.00,
        "items": [{"name": "Test Item", "quantity": 1}],
        "payment_method": "cash"
    }
    restaurant = await db.restaurants.find_one({"id": user.get("restaurant_id")}, {"_id": 0})
    await send_order_notification(test_order, restaurant)
    return {"message": "Test notification sent. Check notification logs."}

@api_router.get("/notifications/settings")
async def get_notification_settings(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return {"sms_enabled": False, "whatsapp_enabled": False}
    settings = await db.notification_settings.find_one({"restaurant_id": user["restaurant_id"]}, {"_id": 0})
    return settings or {"sms_enabled": True, "whatsapp_enabled": True}

@api_router.put("/notifications/settings")
async def update_notification_settings(data: dict, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant")
    await db.notification_settings.update_one(
        {"restaurant_id": user["restaurant_id"]},
        {"$set": {"restaurant_id": user["restaurant_id"], "sms_enabled": data.get("sms_enabled", True), "whatsapp_enabled": data.get("whatsapp_enabled", True)}},
        upsert=True
    )
    return {"message": "Settings updated"}

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
    """Generate a premium PDF day close report."""
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

    # Generate AI insights for PDF
    ai_insights = "AI insights unavailable."
    try:
        pdf_analytics = {
            "daily_sales": total_sales,
            "weekly_sales": total_sales,
            "monthly_sales": total_sales,
            "total_orders": len(paid_orders),
            "top_items": [{"name": k, "count": v} for k, v in item_counts.items()],
            "order_type_breakdown": order_types,
            "payment_breakdown": payment_methods,
            "hourly_orders": [{"hour": h, "orders": v["orders"], "revenue": v["revenue"]} for h, v in sorted(hourly.items())],
            "selected_date": session.get("date", "")
        }
        ai_insights = await generate_ai_insights(pdf_analytics, restaurant.get("name", "Restaurant") if restaurant else "Restaurant", "day_close")
    except Exception as e:
        logger.error(f"PDF AI insights error: {e}")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    pdf.set_fill_color(30, 41, 59)
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

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_fill_color(241, 245, 249)
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

    if top_items:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "  Top Selling Items", fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(226, 232, 240)
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
    clean_insights = ai_insights.replace("**", "").replace("##", "").replace("# ", "")
    clean_insights = clean_insights.replace("\u2022", "-").replace("\u2192", "->").replace("\u2014", "-")
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

    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, f"Generated by DineDesk POS on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", align="C")

    pdf_bytes = pdf.output()
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=day-report-{session.get('date', 'report')}.pdf"}
    )

@api_router.get("/day-session/{session_id}/ai-insights")
async def get_day_close_ai_insights(session_id: str, user: dict = Depends(get_current_user)):
    """Get AI insights for a day session for in-app display."""
    try:
        session = await db.day_sessions.find_one({"id": session_id})
        if not session:
            return {"insights": "Session not found."}
        
        restaurant_id = session.get("restaurant_id", user.get("restaurant_id", "default"))
        restaurant = await db.restaurants.find_one({"id": restaurant_id})
        restaurant_name = restaurant.get("name", "Restaurant") if restaurant else "Restaurant"
        
        # Get orders for this session
        session_start = session.get("opened_at", "")
        session_end = session.get("closed_at", datetime.now(timezone.utc).isoformat())
        
        orders = await db.orders.find({
            "restaurant_id": restaurant_id,
            "created_at": {"$gte": session_start, "$lte": session_end},
            "status": {"$in": ["completed", "paid"]}
        }).to_list(10000)
        
        total_sales = sum(o.get("total_amount", 0) for o in orders)
        total_orders = len(orders)
        
        # Top items
        top_items_map = {}
        for o in orders:
            for item in o.get("items", []):
                name = item.get("name", "Unknown")
                top_items_map[name] = top_items_map.get(name, 0) + item.get("quantity", 1)
        top_items = [{"name": k, "count": v} for k, v in sorted(top_items_map.items(), key=lambda x: -x[1])[:10]]
        
        # Payment breakdown
        payment_map = {}
        for o in orders:
            method = o.get("payment_method", "unknown")
            payment_map[method] = payment_map.get(method, 0) + o.get("total_amount", 0)
        
        # Hourly breakdown
        hourly = {}
        for o in orders:
            try:
                h = datetime.fromisoformat(o["created_at"]).hour
                hourly[h] = hourly.get(h, {"orders": 0, "revenue": 0})
                hourly[h]["orders"] += 1
                hourly[h]["revenue"] += o.get("total_amount", 0)
            except:
                pass
        
        analytics_data = {
            "daily_sales": total_sales,
            "weekly_sales": total_sales,
            "monthly_sales": total_sales,
            "total_orders": total_orders,
            "top_items": top_items,
            "payment_breakdown": payment_map,
            "hourly_orders": [{"hour": h, "orders": v["orders"], "revenue": v["revenue"]} for h, v in sorted(hourly.items())],
            "selected_date": session.get("date", "")
        }
        
        insights = await generate_ai_insights(analytics_data, restaurant_name, "day_close")
        return {"insights": insights}
    except Exception as e:
        logger.error(f"Day close AI insights error: {e}")
        return {"insights": "AI insights temporarily unavailable."}

# ============== CUSTOMER CRM ROUTES ==============

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    tags: List[str] = []
    preferences: Optional[str] = None
    allergies: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    tags: Optional[List[str]] = None
    preferences: Optional[str] = None
    allergies: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    phone: str
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    tags: List[str] = []
    preferences: Optional[str] = None
    allergies: Optional[str] = None
    loyalty_points: int = 0
    tier: str = "silver"
    wallet_balance: float = 0
    total_visits: int = 0
    total_spent: float = 0
    last_visit_at: Optional[str] = None
    created_at: str

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(data: CustomerCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    existing = await db.customers.find_one({"restaurant_id": user["restaurant_id"], "phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this phone already exists")
    customer_id = str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "restaurant_id": user["restaurant_id"],
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "date_of_birth": data.date_of_birth,
        "anniversary_date": data.anniversary_date,
        "tags": data.tags,
        "preferences": data.preferences,
        "allergies": data.allergies,
        "loyalty_points": 0,
        "tier": "silver",
        "wallet_balance": 0,
        "total_visits": 0,
        "total_spent": 0,
        "last_visit_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.insert_one(customer)
    return CustomerResponse(**{k: v for k, v in customer.items() if k != "_id"})

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(search: Optional[str] = None, tier: Optional[str] = None,
                        skip: int = 0, limit: int = 100, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if tier:
        query["tier"] = tier
    limit = min(limit, 500)
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [CustomerResponse(**c) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id, "restaurant_id": user.get("restaurant_id")}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**customer)

@api_router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, data: CustomerUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.customers.update_one(
            {"id": customer_id, "restaurant_id": user.get("restaurant_id")},
            {"$set": update_data}
        )
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**customer)

@api_router.get("/customers/{customer_id}/orders")
async def get_customer_orders(customer_id: str, user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"customer_id": customer_id, "restaurant_id": user.get("restaurant_id")},
        {"_id": 0, "created_by": 0}
    ).sort("created_at", -1).to_list(50)
    return orders

# ============== TRIDENT COINS (LOYALTY) ROUTES ==============

class CoinEarn(BaseModel):
    customer_id: str
    coins: int
    description: str
    order_id: Optional[str] = None

class CoinRedeem(BaseModel):
    customer_id: str
    coins: int
    description: str

class CoinTopup(BaseModel):
    customer_id: str
    amount_inr: float

class CoinDonate(BaseModel):
    customer_id: str
    coins: int

def _calculate_tier(points: int) -> str:
    if points >= 5000:
        return "platinum"
    elif points >= 1000:
        return "gold"
    return "silver"

@api_router.post("/coins/earn")
async def earn_coins(data: CoinEarn, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id, "restaurant_id": user.get("restaurant_id")})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    new_balance = customer.get("loyalty_points", 0) + data.coins
    new_tier = _calculate_tier(new_balance)
    await db.customers.update_one(
        {"id": data.customer_id},
        {"$set": {"loyalty_points": new_balance, "tier": new_tier}}
    )
    txn = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "restaurant_id": user["restaurant_id"],
        "order_id": data.order_id,
        "type": "earn",
        "coins": data.coins,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.coin_transactions.insert_one(txn)
    return {"message": f"Earned {data.coins} Trident Coins", "balance": new_balance, "tier": new_tier}

@api_router.post("/coins/redeem")
async def redeem_coins(data: CoinRedeem, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id, "restaurant_id": user.get("restaurant_id")})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.get("loyalty_points", 0) < data.coins:
        raise HTTPException(status_code=400, detail="Insufficient Trident Coins")
    new_balance = customer["loyalty_points"] - data.coins
    new_tier = _calculate_tier(new_balance)
    await db.customers.update_one(
        {"id": data.customer_id},
        {"$set": {"loyalty_points": new_balance, "tier": new_tier}}
    )
    # 100 coins = ₹20 discount
    discount_value = (data.coins / 100) * 20
    txn = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "restaurant_id": user["restaurant_id"],
        "type": "redeem",
        "coins": data.coins,
        "description": data.description,
        "discount_value": discount_value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.coin_transactions.insert_one(txn)
    return {"message": f"Redeemed {data.coins} Trident Coins (₹{discount_value:.0f} discount)", "balance": new_balance, "discount": discount_value}

@api_router.post("/coins/topup")
async def topup_coins(data: CoinTopup, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id, "restaurant_id": user.get("restaurant_id")})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    # 3% convenience fee, 100 coins = ₹20 value
    fee = data.amount_inr * 0.03
    effective_amount = data.amount_inr - fee
    coins_to_credit = int((effective_amount / 20) * 100)  # ₹20 = 100 coins
    new_balance = customer.get("loyalty_points", 0) + coins_to_credit
    new_tier = _calculate_tier(new_balance)
    await db.customers.update_one(
        {"id": data.customer_id},
        {"$set": {"loyalty_points": new_balance, "tier": new_tier}}
    )
    txn = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "restaurant_id": user["restaurant_id"],
        "type": "topup",
        "coins": coins_to_credit,
        "amount_inr": data.amount_inr,
        "fee": fee,
        "description": f"UPI top-up ₹{data.amount_inr:.0f} (fee ₹{fee:.0f})",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.coin_transactions.insert_one(txn)
    return {"message": f"Credited {coins_to_credit} Trident Coins", "balance": new_balance, "fee": fee}

@api_router.post("/coins/donate")
async def donate_coins(data: CoinDonate, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id, "restaurant_id": user.get("restaurant_id")})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.get("loyalty_points", 0) < data.coins:
        raise HTTPException(status_code=400, detail="Insufficient Trident Coins")
    new_balance = customer["loyalty_points"] - data.coins
    new_tier = _calculate_tier(new_balance)
    await db.customers.update_one(
        {"id": data.customer_id},
        {"$set": {"loyalty_points": new_balance, "tier": new_tier}}
    )
    txn = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "restaurant_id": user["restaurant_id"],
        "type": "donate",
        "coins": data.coins,
        "description": "Donated to Seva",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.coin_transactions.insert_one(txn)
    return {"message": f"Donated {data.coins} Trident Coins to Seva 🙏", "balance": new_balance}

@api_router.get("/coins/transactions")
async def get_coin_transactions(customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if customer_id:
        query["customer_id"] = customer_id
    txns = await db.coin_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return txns

# ============== GIFT CARD ROUTES ==============

class GiftCardPurchase(BaseModel):
    face_value: float
    customer_id: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_name: Optional[str] = None

class GiftCardRedeem(BaseModel):
    code: str
    amount: float

@api_router.post("/giftcards/purchase")
async def purchase_gift_card(data: GiftCardPurchase, user: dict = Depends(get_current_user)):
    code = f"DD-{uuid.uuid4().hex[:8].upper()}"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    gift_card = {
        "id": str(uuid.uuid4()),
        "code": code,
        "face_value": data.face_value,
        "balance": data.face_value,
        "customer_id": data.customer_id,
        "restaurant_id": user.get("restaurant_id", "platform"),
        "recipient_phone": data.recipient_phone,
        "recipient_name": data.recipient_name,
        "status": "active",
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gift_cards.insert_one(gift_card)
    # Earn coins: ₹1000 = 10 coins
    coins_earned = int((data.face_value / 1000) * 10)
    return {
        "code": code,
        "face_value": data.face_value,
        "expires_at": expires_at,
        "coins_earned": coins_earned,
        "message": f"Gift card {code} created successfully"
    }

@api_router.post("/giftcards/redeem")
async def redeem_gift_card(data: GiftCardRedeem, user: dict = Depends(get_current_user)):
    gift_card = await db.gift_cards.find_one({"code": data.code, "status": "active"})
    if not gift_card:
        raise HTTPException(status_code=404, detail="Invalid or expired gift card")
    if gift_card["balance"] < data.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ₹{gift_card['balance']:.2f}")
    new_balance = gift_card["balance"] - data.amount
    await db.gift_cards.update_one(
        {"code": data.code},
        {"$set": {"balance": new_balance, "status": "redeemed" if new_balance <= 0 else "active"}}
    )
    # Record transaction
    txn = {
        "id": str(uuid.uuid4()),
        "gift_card_id": gift_card["id"],
        "restaurant_id": user.get("restaurant_id"),
        "amount": data.amount,
        "type": "redeem",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gift_card_transactions.insert_one(txn)
    # Settlement: restaurant gets 95%
    settlement_amount = data.amount * 0.95
    return {
        "message": f"Gift card redeemed: ₹{data.amount:.2f}",
        "remaining_balance": new_balance,
        "settlement_amount": settlement_amount
    }

@api_router.get("/giftcards/{code}")
async def get_gift_card(code: str, user: dict = Depends(get_current_user)):
    gift_card = await db.gift_cards.find_one({"code": code}, {"_id": 0})
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    return gift_card

@api_router.get("/giftcards")
async def list_gift_cards(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    cards = await db.gift_cards.find(
        {"restaurant_id": user["restaurant_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return cards

# ============== SEVA (DONATION) ROUTES ==============

@api_router.get("/seva/stats")
async def get_seva_stats(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return {"total_donations": 0, "meals_funded": 0, "coins_donated": 0}
    # Get coin donations
    pipeline = [
        {"$match": {"restaurant_id": user["restaurant_id"], "type": "donate"}},
        {"$group": {"_id": None, "total_coins": {"$sum": "$coins"}, "count": {"$sum": 1}}}
    ]
    result = await db.coin_transactions.aggregate(pipeline).to_list(1)
    coins_donated = result[0]["total_coins"] if result else 0
    # 100 coins = ₹20, ~₹50 per meal
    rupees_donated = (coins_donated / 100) * 20
    meals_funded = int(rupees_donated / 50) if rupees_donated > 0 else 0
    return {
        "total_donations": rupees_donated,
        "meals_funded": meals_funded,
        "coins_donated": coins_donated,
        "impact_message": f"{meals_funded} meals funded through Seva donations 🙏" if meals_funded > 0 else "Start donating to feed the hungry"
    }

# ============== STORE (ADD-ON SUBSCRIPTIONS) ROUTES ==============

STORE_ADDONS = [
    {"id": "crm_loyalty", "name": "CRM & Loyalty", "description": "Trident Coins, customer profiles, tier system, birthday/anniversary reminders", "icon": "Users", "monthly_price": 499, "annual_price": 4999, "category": "growth"},
    {"id": "inventory", "name": "Inventory Management", "description": "Raw material tracking, recipe management, stock alerts, purchase orders", "icon": "Package", "monthly_price": 299, "annual_price": 2999, "category": "operations"},
    {"id": "whatsapp", "name": "WhatsApp Marketing", "description": "Campaigns, templates, birthday offers, win-back messages, delivery tracking", "icon": "MessageCircle", "monthly_price": 799, "annual_price": 7999, "category": "marketing"},
    {"id": "multi_branch", "name": "Multi-Branch Dashboard", "description": "Manage multiple locations, cross-branch analytics, centralized menu", "icon": "Building2", "monthly_price": 999, "annual_price": 9999, "category": "enterprise"},
    {"id": "analytics_pro", "name": "Advanced Analytics", "description": "AI insights, predictive analytics, anomaly detection, custom reports", "icon": "BarChart3", "monthly_price": 599, "annual_price": 5999, "category": "insights"},
    {"id": "api_access", "name": "API Access", "description": "REST API access, webhooks, third-party integrations, developer portal", "icon": "Code2", "monthly_price": 399, "annual_price": 3999, "category": "developer"},
    {"id": "custom_branding", "name": "Custom Branding", "description": "White-label receipts, custom themes, branded customer app", "icon": "Palette", "monthly_price": 299, "annual_price": 2999, "category": "branding"},
    {"id": "gift_cards", "name": "Gift Cards & Vouchers", "description": "Digital gift cards, QR codes, gifting, settlement dashboard", "icon": "Gift", "monthly_price": 399, "annual_price": 3999, "category": "growth"},
]

@api_router.get("/store/addons")
async def get_store_addons():
    return STORE_ADDONS

@api_router.get("/store/subscription")
async def get_store_subscription(user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return {"active_addons": [], "plan": "starter"}
    sub = await db.restaurant_subscriptions.find_one(
        {"restaurant_id": user["restaurant_id"]}, {"_id": 0}
    )
    return sub or {"restaurant_id": user["restaurant_id"], "active_addons": [], "plan": "starter"}

@api_router.post("/store/subscribe")
async def subscribe_addon(addon_id: str, billing: str = "monthly", user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    addon = next((a for a in STORE_ADDONS if a["id"] == addon_id), None)
    if not addon:
        raise HTTPException(status_code=404, detail="Add-on not found")
    existing = await db.restaurant_subscriptions.find_one({"restaurant_id": user["restaurant_id"]})
    active_addons = (existing or {}).get("active_addons", [])
    if addon_id in active_addons:
        raise HTTPException(status_code=400, detail="Already subscribed")
    active_addons.append(addon_id)
    await db.restaurant_subscriptions.update_one(
        {"restaurant_id": user["restaurant_id"]},
        {"$set": {"active_addons": active_addons, "plan": "pro", "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": f"Subscribed to {addon['name']}", "active_addons": active_addons}

@api_router.post("/store/unsubscribe")
async def unsubscribe_addon(addon_id: str, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    existing = await db.restaurant_subscriptions.find_one({"restaurant_id": user["restaurant_id"]})
    active_addons = (existing or {}).get("active_addons", [])
    if addon_id not in active_addons:
        raise HTTPException(status_code=400, detail="Not subscribed to this add-on")
    active_addons.remove(addon_id)
    await db.restaurant_subscriptions.update_one(
        {"restaurant_id": user["restaurant_id"]},
        {"$set": {"active_addons": active_addons, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Unsubscribed successfully", "active_addons": active_addons}

# ============== FEEDBACK ROUTES ==============

class FeedbackCreate(BaseModel):
    order_id: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    category: str = "general"

@api_router.post("/feedback")
async def create_feedback(data: FeedbackCreate, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="No restaurant associated")
    fb = {
        "id": str(uuid.uuid4()),
        "restaurant_id": user["restaurant_id"],
        "order_id": data.order_id,
        "rating": data.rating,
        "comment": data.comment,
        "category": data.category,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.feedback.insert_one(fb)
    return {"message": "Thank you for your feedback!", "id": fb["id"]}

@api_router.get("/feedback")
async def get_feedback(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("restaurant_id"):
        return []
    query = {"restaurant_id": user["restaurant_id"]}
    if status:
        query["status"] = status
    feedbacks = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return feedbacks

# ============== UTILITY ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "DineDesk POS API", "version": "3.0.0"}

@api_router.get("/health")
async def health():
    checks = {"status": "healthy", "version": "3.0.0"}
    try:
        await db.command("ping")
        checks["mongodb"] = "connected"
    except Exception as e:
        checks["status"] = "degraded"
        checks["mongodb"] = f"error: {str(e)[:100]}"
    return checks

app.include_router(api_router)

app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

_cors_env = os.environ.get('CORS_ORIGINS', '')
_cors_list = [o.strip() for o in _cors_env.split(',') if o.strip()]
# ALWAYS include these origins — merge, never replace.
# (If CORS_ORIGINS env var is stale, production still works.)
for _o in [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://revontechologies.in',
    'https://www.revontechologies.in',
]:
    if _o not in _cors_list:
        _cors_list.append(_o)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


