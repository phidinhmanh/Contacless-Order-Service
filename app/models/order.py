from datetime import datetime, UTC
from enum import Enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class OrderStatus(str, Enum):
    PAID = "paid"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    PAYMENT_FAILED = "payment_failed"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="SET NULL"), nullable=True)
    total_price = Column(Float, default=0.0)
    status = Column(String(20), default="pending", index=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    special_instructions = Column(String(500), nullable=True)  # For "không cay", "nhiều sốt", etc.
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    user = relationship("User", back_populates="orders")
    table = relationship("Table", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    # Composite index for common queries
    __table_args__ = (
        Index("ix_orders_status_created", "status", "created_at"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)  # Store price at time of order

    # Relationships
    order = relationship("Order", back_populates="items")
    food = relationship("Food", back_populates="order_items")
