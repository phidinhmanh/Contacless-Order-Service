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
    VIETQR = "vietqr"  # Zero-fee bank transfer via QR code
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"  # Legacy/manual bank transfer


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


class VietQRResponse(BaseModel):
    """Response containing VietQR payment details."""
    id: int
    order_id: int
    amount: float
    currency: str = "VND"
    status: PaymentStatus
    provider: str = "vietqr"
    qr_url: str  # VietQR image URL
    bank_id: str
    account_no: str
    account_name: str
    transfer_content: str  # e.g., "THANH TOAN DON OC_123"
    expires_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class CassoTransaction(BaseModel):
    """Single transaction from Casso webhook."""
    id: str = Field(..., description="Casso transaction ID")
    tid: str | None = Field(None, description="Bank transaction ID")
    description: str = Field(..., description="Transfer content, contains order ID")
    amount: float = Field(..., gt=0)
    when: str | None = Field(None, description="Transaction timestamp")
    bank_sub_acc_id: str | None = Field(None, description="Sub account ID")


class CassoWebhookPayload(BaseModel):
    """Casso webhook payload format."""
    error: int = Field(0, description="Error code, 0 = success")
    data: list[CassoTransaction] = Field(default_factory=list)
