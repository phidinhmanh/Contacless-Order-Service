from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class OrderItemBase(BaseModel):
    """Base order item schema."""
    food_id: int
    quantity: int = 1


class OrderItemCreate(OrderItemBase):
    """Schema for creating an order item."""
    pass


class OrderItemResponse(OrderItemBase):
    """Schema for order item response."""
    id: int
    unit_price: float
    food_name: str | None = None  # Populated via relationship

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def subtotal(self) -> float:
        """Calculate subtotal for this item."""
        return self.unit_price * self.quantity


class OrderBase(BaseModel):
    """Base order schema with common fields."""
    user_id: int | None = None  # Optional for guest users
    table_id: int
    table_session_id: int | None = None  # Links order to session
    special_instructions: str | None = None


class OrderCreate(OrderBase):
    """Schema for creating a new order."""
    items: list[OrderItemCreate]
    idempotency_key: str | None = None


class OrderUpdate(BaseModel):
    """Schema for updating an order. All fields optional."""
    status: str | None = None
    payment_status: str | None = None
    total_price: float | None = None


class OrderResponse(OrderBase):
    """Schema for order response."""
    id: int
    total_price: float
    status: str
    payment_status: str | None = "unpaid"
    idempotency_key: str | None
    special_instructions: str | None
    created_at: datetime
    items: list[OrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def total_amount(self) -> float:
        """Alias for total_price for frontend compatibility."""
        return self.total_price
