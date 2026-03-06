import enum
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class UserRole(str, enum.Enum):
    """User roles for access control."""

    CUSTOMER = 'customer'
    STAFF = 'staff'
    KITCHEN = 'kitchen'
    MANAGER = 'manager'
    ADMIN = 'admin'


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    full_name = Column(String(100))
    gender = Column(String(10))
    age_group = Column(String(20), nullable=True)  # under_18, 18_24, 25_34, etc.

    # Authentication fields
    hashed_password = Column(String(255), nullable=True)  # nullable for guest users
    role = Column(String(20), default=UserRole.CUSTOMER.value, index=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    last_login = Column(DateTime, nullable=True)

    # Relationships
    orders = relationship('Order', back_populates='user')
