from pydantic import BaseModel, ConfigDict, Field


class TableBase(BaseModel):
    """Base table schema with common fields."""
    table_number: int = Field(..., ge=1, description="Table number (must be positive)")
    capacity: int = Field(default=4, ge=1, le=20, description="Seating capacity")


class TableCreate(TableBase):
    """Schema for creating a new table."""
    pass


class TableUpdate(BaseModel):
    """Schema for updating a table. All fields optional."""
    table_number: int | None = None
    capacity: int | None = Field(default=None, ge=1, le=20)
    is_occupied: bool | None = None
    qr_token: str | None = None


class TableResponse(TableBase):
    """Schema for table response."""
    id: int
    is_occupied: bool = False
    qr_code_path: str | None = None
    qr_token: str | None = None

    model_config = ConfigDict(from_attributes=True)
