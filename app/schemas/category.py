from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    """Base category schema with common fields."""
    name: str = Field(..., max_length=50)
    description: str | None = None
    display_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    """Schema for creating a new category."""
    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a category. All fields optional."""
    name: str | None = None
    description: str | None = None
    display_order: int | None = None
    is_active: bool = Field(default=True)


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
