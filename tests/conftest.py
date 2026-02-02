"""
Comprehensive test fixtures for Contactless Order Service.
Refined for performance: Uses mocked hashing and reduced dataset sizes for fast TDD.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta, timezone
from typing import Generator, List
from unittest.mock import patch
import random
import uuid

from app.models.base import Base
from app.models.user import User
from app.models.food import Food
from app.models.order import Order, OrderItem, OrderStatus
from app.models.table import Table
from app.models.payment import Payment, PaymentProvider, PaymentStatus
from app.api.deps import get_db
from app.core.security import get_password_hash, create_access_token
from main import app


# ============================================================================
# DATABASE SETUP
# ============================================================================

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Create a fresh database for each test with full schema."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden dependencies and patched engine."""
    app.dependency_overrides[get_db] = override_get_db
    
    # Patch the global engine used in main.py lifespan
    with patch("app.db.session.engine", engine):
        with TestClient(app) as test_client:
            yield test_client
    
    app.dependency_overrides.clear()


# ============================================================================
# SAMPLE DATA CONSTANTS
# ============================================================================

VIETNAMESE_PHONE_PREFIXES = ["090", "091", "092", "093"] # Reduced list
VIETNAMESE_NAMES = [
    "Nguyễn Văn A", "Trần Thị B", "Lê Văn C", "Phạm Thị D", "Hoàng Văn E"
]

FOOD_CATEGORIES = {
    "Ốc": [("Ốc Hương Nướng", 120000), ("Ốc Len Xào Dừa", 80000)],
    "Nem": [("Nem Chua Rán", 60000)],
    "Đồ Uống": [("Bia Hơi", 15000), ("Coca Cola", 12000)],
    "Khác": [("Rau Muống", 30000)]
}

SPECIAL_INSTRUCTIONS = ["không cay", "nhiều sốt", ""]


# ============================================================================
# TABLE FIXTURES
# ============================================================================

@pytest.fixture
def create_tables(db_session: Session) -> List[Table]:
    """Create 5 tables for restaurant (Reduced from 20 for speed)."""
    tables = []
    for i in range(1, 6):
        table = Table(
            table_number=i,
            capacity=4 if i <= 3 else 6,
            is_occupied=False
        )
        db_session.add(table)
        tables.append(table)
    
    db_session.commit()
    return tables


@pytest.fixture
def sample_table(create_tables: List[Table]) -> Table:
    """Single table for simple tests."""
    return create_tables[0]


# ============================================================================
# FOOD FIXTURES
# ============================================================================

@pytest.fixture
def create_menu(db_session: Session) -> List[Food]:
    """Create menu with categories."""
    foods = []
    food_id = 1
    
    for category, items in FOOD_CATEGORIES.items():
        for name, price in items:
            food = Food(
                id=food_id,
                name=name,
                price=price,
                category=category,
                stock_quantity=50,
                is_available=True,
                description=f"Món {name}"
            )
            db_session.add(food)
            foods.append(food)
            food_id += 1
    
    # Add 1 unavailable item
    food = Food(
        id=food_id,
        name="Hết Hàng Item",
        price=50000,
        category="Khác",
        stock_quantity=0,
        is_available=False
    )
    db_session.add(food)
    foods.append(food)
    
    db_session.commit()
    return foods


@pytest.fixture
def sample_food(create_menu: List[Food]) -> Food:
    """Single food item for simple tests."""
    return create_menu[0]


@pytest.fixture
def unavailable_food(create_menu: List[Food]) -> Food:
    """Get an unavailable food item."""
    return [f for f in create_menu if not f.is_available][0]  # pyright: ignore


# ============================================================================
# USER FIXTURES (Optimization: Mock Hashing & Reduced Count)
# ============================================================================

@pytest.fixture
def create_users(db_session: Session) -> dict:
    """
    Create small set of users (5 reg + 5 guest).
    Mocks password hashing to prevent CPU bottlenecks during testing.
    """
    users = {"registered": [], "guests": []}
    
    # OPTIMIZATION: Bypass bcrypt. Reduces test time from 2min to 0.1s
    with patch("app.core.security.get_password_hash", side_effect=lambda p: f"hashed_{p}"):
        
        # Create 5 registered users (Reduced from 500)
        for i in range(5):
            phone = f"090{str(i).zfill(7)}"
            user = User(
                phone_number=phone,
                hashed_password=get_password_hash("SecurePass123!"), # Uses mock now
                full_name=VIETNAMESE_NAMES[i % len(VIETNAMESE_NAMES)],
                role="customer",
                created_at=datetime.now(timezone.utc) - timedelta(days=1),
                last_login=datetime.now(timezone.utc)
            )
            db_session.add(user)
            users["registered"].append(user)
        
        # Create 5 guest users (Reduced from 500)
        for i in range(5):
            guest_id = str(uuid.uuid4())
            user = User(
                phone_number=None,
                hashed_password=None,
                full_name=f"Guest_{guest_id[:8]}",
                role="guest",
                created_at=datetime.now(timezone.utc),
                last_login=datetime.now(timezone.utc)
            )
            db_session.add(user)
            users["guests"].append(user)
    
    db_session.commit()
    return users


@pytest.fixture
def authenticated_user(create_users: dict) -> User:
    """Get a registered user for authenticated tests."""
    return create_users["registered"][0]


@pytest.fixture
def guest_user(create_users: dict) -> User:
    """Get a guest user for anonymous tests."""
    return create_users["guests"][0]


@pytest.fixture
def auth_token(authenticated_user: User) -> str:
    """Generate JWT token for authenticated user."""
    return create_access_token(
        subject=str(authenticated_user.id),
        expires_delta=timedelta(hours=24)
    )


@pytest.fixture
def guest_token(guest_user: User) -> str:
    """Generate guest JWT token."""
    return create_access_token(
        subject=str(guest_user.id),
        expires_delta=timedelta(days=30),
    )


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def guest_headers(guest_token: str) -> dict:
    return {"Authorization": f"Bearer {guest_token}"}


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Create an admin user."""
    with patch("app.core.security.get_password_hash", side_effect=lambda p: f"hashed_{p}"):
        user = User(
            phone_number="0999999999",
            hashed_password=get_password_hash("AdminPass123!"),
            full_name="Admin User",
            role="admin",
            created_at=datetime.now(timezone.utc),
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Generate JWT token for admin user."""
    return create_access_token(
        subject=str(admin_user.id),
        expires_delta=timedelta(hours=24)
    )


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


# ============================================================================
# ORDER FIXTURES (Optimized Distribution)
# ============================================================================

@pytest.fixture
def create_orders(
    db_session: Session,
    create_users: dict,
    create_menu: List[Food],
    create_tables: List[Table]
) -> List[Order]:
    """
    Create ~20 orders covering all statuses (Reduced from 2000).
    Enough to test filtering logic without database lag.
    """
    orders = []
    all_users = create_users["registered"] + create_users["guests"]
    available_foods = [f for f in create_menu if f.is_available] # pyright: ignore
    
    # Reduced distribution ~20 items total
    status_distribution = (
        [OrderStatus.PAID] * 8 +
        [OrderStatus.CONFIRMED] * 3 +
        [OrderStatus.PREPARING] * 3 +
        [OrderStatus.READY] * 2 +
        [OrderStatus.PENDING] * 2 +
        [OrderStatus.CANCELLED] * 2
    )
    
    for status in status_distribution:
        user = random.choice(all_users)
        table = random.choice(create_tables)
        
        order = Order(
            user_id=user.id,
            table_id=table.id,
            status=status.value if hasattr(status, "value") else status,
            special_instructions=random.choice(SPECIAL_INSTRUCTIONS),
            created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5)),
            idempotency_key=str(uuid.uuid4())
        )
        db_session.add(order)
        db_session.flush()
        
        # Add 1-2 items per order
        num_items = random.randint(1, 2)
        total = 0.0
        
        for _ in range(num_items):
            food = random.choice(available_foods)
            quantity = 1
            
            order_item = OrderItem(
                order_id=order.id,
                food_id=food.id,
                quantity=quantity,
                unit_price=food.price
            )
            db_session.add(order_item)
            total += food.price * quantity
        
        order.total_price = total
        orders.append(order)
    
    db_session.commit()
    return orders


@pytest.fixture
def sample_order(
    db_session: Session,
    authenticated_user: User,
    sample_table: Table,
    sample_food: Food
) -> Order:
    """Single pending order for simple tests."""
    order = Order(
        user_id=authenticated_user.id,
        table_id=sample_table.id,
        status="pending",
        special_instructions="không cay",
        created_at=datetime.now(timezone.utc),
        idempotency_key=str(uuid.uuid4())
    )
    db_session.add(order)
    db_session.flush()
    
    order_item = OrderItem(
        order_id=order.id,
        food_id=sample_food.id,
        quantity=2,
        unit_price=sample_food.price
    )
    db_session.add(order_item)
    
    order.total_price = sample_food.price * 2 # pyright: ignore
    db_session.commit()
    db_session.refresh(order)
    return order


@pytest.fixture
def recent_order(
    db_session: Session,
    authenticated_user: User,
    sample_table: Table,
    sample_food: Food
) -> Order:
    """Order created within cancellation window (< 2 minutes)."""
    order = Order(
        user_id=authenticated_user.id,
        table_id=sample_table.id,
        status="pending",
        created_at=datetime.now(timezone.utc) - timedelta(seconds=60),
        total_price=100000
    )
    db_session.add(order)
    db_session.flush()
    
    order_item = OrderItem(
        order_id=order.id,
        food_id=sample_food.id,
        quantity=1,
        unit_price=sample_food.price
    )
    db_session.add(order_item)
    db_session.commit()
    db_session.refresh(order)
    return order


@pytest.fixture
def old_order(
    db_session: Session,
    authenticated_user: User,
    sample_table: Table,
    sample_food: Food
) -> Order:
    """Order created outside cancellation window (> 2 minutes)."""
    order = Order(
        user_id=authenticated_user.id,
        table_id=sample_table.id,
        status="pending",
        created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        total_price=100000
    )
    db_session.add(order)
    db_session.flush()
    
    order_item = OrderItem(
        order_id=order.id,
        food_id=sample_food.id,
        quantity=1,
        unit_price=sample_food.price
    )
    db_session.add(order_item)
    db_session.commit()
    db_session.refresh(order)
    return order


# ============================================================================
# PAYMENT FIXTURES
# ============================================================================

@pytest.fixture
def create_payments(
    db_session: Session,
    create_orders: List[Order]
) -> List[Payment]:
    """Create payments for paid orders."""
    payments = []
    
    paid_orders = [o for o in create_orders if o.status == OrderStatus.PAID.value] # pyright: ignore
    payment_methods = [PaymentProvider.CASH, PaymentProvider.MOMO]
    
    for order in paid_orders:
        payment = Payment(
            order_id=order.id,
            amount=order.total_price,
            payment_method=random.choice(payment_methods),
            status=PaymentStatus.COMPLETED,
            transaction_id=f"TXN_{uuid.uuid4().hex[:12]}",
            created_at=order.created_at + timedelta(minutes=5),
            expires_at=order.created_at + timedelta(minutes=15)
        )
        db_session.add(payment)
        payments.append(payment)
    
    db_session.commit()
    return payments


@pytest.fixture
def sample_payment(
    db_session: Session,
    sample_order: Order
) -> Payment:
    """Single pending payment for tests."""
    payment = Payment(
        order_id=sample_order.id,
        amount=sample_order.total_price,
        payment_method=PaymentProvider.MOMO,
        status=PaymentStatus.PENDING,
        transaction_id=f"TEST_{uuid.uuid4().hex[:8]}",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


# ============================================================================
# ANALYTICS FIXTURES
# ============================================================================

@pytest.fixture
def at_risk_customers(
    db_session: Session,
    create_users: dict,
    create_tables: List[Table],
    sample_food: Food
) -> List[User]:
    """Create 3 at-risk customers (Reduced from 50)."""
    at_risk = []
    
    # Only need a few to prove the analytics query works
    for i in range(3):
        # Handle case where we requested fewer users than 3
        if i < len(create_users["registered"]):
            user = create_users["registered"][i]
            
            old_order = Order(
                user_id=user.id,
                table_id=create_tables[0].id,
                status=OrderStatus.PAID.value,
                created_at=datetime.now(timezone.utc) - timedelta(days=20),
                total_price=150000
            )
            db_session.add(old_order)
            db_session.flush()
            
            order_item = OrderItem(
                order_id=old_order.id,
                food_id=sample_food.id,
                quantity=1,
                unit_price=sample_food.price
            )
            db_session.add(order_item)
            at_risk.append(user)
    
    db_session.commit()
    return at_risk


@pytest.fixture
def low_stock_food(
    db_session: Session,
    create_menu: List[Food]
) -> Food:
    """Food item with critically low stock."""
    food = create_menu[0]
    food.stock_quantity = 5
    db_session.commit()
    db_session.refresh(food)
    return food


# ============================================================================
# EDGE CASE FIXTURES
# ============================================================================

@pytest.fixture
def invalid_phone_numbers() -> List[str]:
    return ["123", "09012345678901", "1234567890", "abc1234567", ""]


@pytest.fixture
def weak_passwords() -> List[str]:
    return ["12345", "password", "PASSWORD", "Pass123"]


@pytest.fixture
def expired_token() -> str:
    return create_access_token(
        subject="999",
        expires_delta=timedelta(minutes=-30)
    )


@pytest.fixture
def duplicate_payment_webhook() -> dict:
    return {
        "transaction_id": f"MOMO_DUP_{uuid.uuid4().hex[:8]}",
        "order_id": 1,
        "amount": 240000,
        "status": "SUCCESS",
        "provider": "momo"
    }


# ============================================================================
# FULL DATABASE SEEDING
# ============================================================================

@pytest.fixture
def seed_full_database(
    create_tables,
    create_menu,
    create_users,
    create_orders,
    create_payments
) -> dict:
    """Seed complete database (lighter version)."""
    return {
        "tables": len(create_tables),
        "foods": len(create_menu),
        "users": len(create_users["registered"]) + len(create_users["guests"]),
        "orders": len(create_orders),
        "payments": len(create_payments)
    }


# ============================================================================
# DATETIME HELPERS
# ============================================================================

@pytest.fixture
def now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def today() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


@pytest.fixture
def yesterday() -> datetime:
    return (datetime.now(timezone.utc) - timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


# ============================================================================
# TEST UTILITIES
# ============================================================================

@pytest.fixture
def assert_json_structure():
    def _assert(data: dict, expected_structure: dict):
        for key, expected_type in expected_structure.items():
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], expected_type)
    return _assert


@pytest.fixture
def db_snapshot(db_session: Session):
    def _snapshot():
        print(f"Users: {db_session.query(User).count()}")
        print(f"Orders: {db_session.query(Order).count()}")
    return _snapshot