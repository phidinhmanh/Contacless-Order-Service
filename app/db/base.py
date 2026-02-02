"""
Database model imports for Alembic.
Import all models here so Alembic can discover them.
"""

# Import Base from models so Alembic sees it
from app.models.base import Base  # noqa

# Import all models for Alembic auto-discovery
from app.models.user import User  # noqa
from app.models.food import Food  # noqa
from app.models.table import Table  # noqa
from app.models.order import Order, OrderItem  # noqa
from app.models.payment import Payment  # noqa
from app.models.audit import AuditLog  # noqa
