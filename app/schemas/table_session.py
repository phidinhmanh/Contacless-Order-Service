from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TableSessionBase(BaseModel):
    guest_count: int = Field(default=1, ge=1, le=20)


class TableSessionCreate(TableSessionBase):
    pass


class TableSessionUpdate(BaseModel):
    guest_count: int | None = Field(None, ge=1, le=20)
    status: str | None = None
    lead_user_id: int | None = None


class TableSessionResponse(TableSessionBase):
    id: int
    table_id: int
    lead_user_id: int | None
    status: str
    created_at: datetime
    closed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)
