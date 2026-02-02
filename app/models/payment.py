import enum
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class PaymentStatus(str, enum.Enum):
    """Payment status values."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentProvider(str, enum.Enum):
    """Supported payment providers."""
    MOMO = "momo"
    VNPAY = "vnpay"
    ZALOPAY = "zalopay"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)

    # Payment details
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="VND")
    status = Column(String(20), default=PaymentStatus.PENDING.value, index=True)
    provider = Column(String(20), nullable=False)

    # Provider transaction ID - UNIQUE for idempotency
    transaction_id = Column(String(100), unique=True, nullable=True, index=True)
    provider_response = Column(String(1000), nullable=True)  # JSON stored as string

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # 15 minute timeout

    # Relationships
    order = relationship("Order", backref="payments")

    # Composite indexes
    __table_args__ = (
        Index("ix_payments_status_created", "status", "created_at"),
        Index("ix_payments_order_status", "order_id", "status"),
    )
