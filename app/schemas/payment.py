from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentProvider(str, Enum):
    MOMO = "momo"
    VNPAY = "vnpay"
    ZALOPAY = "zalopay"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"


class PaymentCreate(BaseModel):
    """Schema for initiating a payment."""
    order_id: int
    provider: PaymentProvider
    amount: float = Field(..., gt=0)


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: int
    order_id: int | None
    amount: float
    currency: str
    status: PaymentStatus
    provider: str
    transaction_id: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    expires_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class WebhookPayload(BaseModel):
    """
    Generic webhook payload from payment providers.
    Each provider sends different formats - this captures common fields.
    """
    transaction_id: str = Field(..., description="Unique transaction ID from provider")
    order_id: int | None = Field(None, description="Our order ID if included")
    status: str = Field(..., description="Payment status from provider")
    amount: float = Field(..., gt=0)
    provider: str
    signature: str | None = Field(None, description="Webhook signature for verification")
    raw_data: dict | None = Field(None, description="Full provider response")


class PaymentStatusResponse(BaseModel):
    """Response for payment status check."""
    payment_id: int
    order_id: int | None
    status: PaymentStatus
    amount: float
    provider: str
    message: str
