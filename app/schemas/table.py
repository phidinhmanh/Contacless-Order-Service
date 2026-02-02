from pydantic import BaseModel, ConfigDict


class TableBase(BaseModel):
    """Base table schema with common fields."""
    table_number: int


class TableCreate(TableBase):
    """Schema for creating a new table."""
    pass


class TableUpdate(BaseModel):
    """Schema for updating a table. All fields optional."""
    table_number: int | None = None


class TableResponse(TableBase):
    """Schema for table response."""
    id: int

    model_config = ConfigDict(from_attributes=True)
