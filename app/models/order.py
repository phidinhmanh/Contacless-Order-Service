from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class OrderStatus(str, Enum):
    PAID = 'paid'
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    PREPARING = 'preparing'
    READY = 'ready'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

    @classmethod
    def get_next_status(cls, current_status: str) -> str | None:
        """Simplified state machine for order status transitions."""
        transitions: dict[str, str] = {
            cls.PENDING: cls.CONFIRMED,
            cls.CONFIRMED: cls.PREPARING,
            cls.PREPARING: cls.READY,
            cls.READY: cls.COMPLETED,
        }
        return transitions.get(current_status)


class PaymentStatusEnum(str, Enum):
    """Payment status for orders."""

    UNPAID = 'unpaid'
    PAID = 'paid'
    REFUNDED = 'refunded'
    FAILED = 'failed'


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )
    table_id = Column(
        Integer, ForeignKey('tables.id', ondelete='SET NULL'), nullable=True
    )
    table_session_id = Column(
        Integer,
        ForeignKey('table_sessions.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    total_price = Column(Float, default=0.0)
    status = Column(
        String(20),
        default='pending',
        server_default='pending',
        nullable=False,
        index=True,
    )
    payment_status = Column(
        String(20), default='unpaid', index=True
    )  # Avoids JOINs with Payment table
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    special_instructions = Column(
        String(500), nullable=True
    )  # For "không cay", "nhiều sốt", etc.
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_at = Column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    # Relationships
    user = relationship('User', back_populates='orders')
    table = relationship('Table', back_populates='orders')
    table_session = relationship('TableSession', back_populates='orders')
    items = relationship(
        'OrderItem', back_populates='order', cascade='all, delete-orphan'
    )

    # Composite index for common queries
    __table_args__ = (Index('ix_orders_status_created', 'status', 'created_at'),)


class OrderItem(Base):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True)
    order_id = Column(
        Integer, ForeignKey('orders.id', ondelete='CASCADE'), nullable=False
    )
    food_id = Column(
        Integer, ForeignKey('foods.id', ondelete='SET NULL'), nullable=True
    )
    quantity = Column(Integer, default=1)
    unit_price = Column(
        Float, nullable=False
    )  # Store price at time of order (Price Snapshot)

    # Relationships
    order = relationship('Order', back_populates='items')
    food = relationship('Food', back_populates='order_items')

    @property
    def food_name(self) -> str | None:
        """Get food name from relationship for API response."""
        return self.food.name if self.food else None
