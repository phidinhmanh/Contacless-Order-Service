from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class FoodBase(BaseModel):
    """Base food schema with common fields."""
    name: str
    price: float
    category: str
    stock_quantity: int | None = 0


class FoodCreate(FoodBase):
    """Schema for creating a new food item."""
    pass


class FoodUpdate(BaseModel):
    """Schema for updating a food item. All fields optional."""
    name: str | None = None
    price: float | None = None
    category: str | None = None
    is_available: bool | None = None
    stock_quantity: int | None = None
    description: str | None = None
    image_url: str | None = None


class FoodStockUpdate(BaseModel):
    """Schema for quick mid-shift stock updates."""
    stock_quantity: int = Field(..., ge=0)
    is_available: bool | None = None


class FoodResponse(FoodBase):
    """Schema for food response."""
    id: int
    is_available: bool
    description: str | None = None
    image_url: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

