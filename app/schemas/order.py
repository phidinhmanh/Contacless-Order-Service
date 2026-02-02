from datetime import datetime

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)


class OrderBase(BaseModel):
    """Base order schema with common fields."""
    user_id: int
    table_id: int
    special_instructions: str | None = None


class OrderCreate(OrderBase):
    """Schema for creating a new order."""
    items: list[OrderItemCreate]
    idempotency_key: str | None = None


class OrderUpdate(BaseModel):
    """Schema for updating an order. All fields optional."""
    status: str | None = None
    total_price: float | None = None


class OrderResponse(OrderBase):
    """Schema for order response."""
    id: int
    total_price: float
    status: str
    idempotency_key: str | None
    special_instructions: str | None
    created_at: datetime
    items: list[OrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
