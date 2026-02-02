import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Vietnamese phone regex: starts with 0 or +84, followed by 3,5,7,8,9 and 8 more digits
VIETNAM_PHONE_REGEX = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"


class UserBase(BaseModel):
    """Base user schema with common fields."""
    phone_number: str = Field(..., min_length=10, max_length=15)
    full_name: str = Field(..., min_length=1, max_length=100)
    gender: str | None = None

    @field_validator("phone_number")
    @classmethod
    def validate_vietnamese_phone(cls, v: str) -> str:
        """Validate Vietnamese phone number format."""
        # Remove spaces and dashes
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(VIETNAM_PHONE_REGEX, cleaned):
            raise ValueError(
                "Invalid Vietnamese phone number. Must start with 0 or +84, "
                "followed by 3, 5, 7, 8, or 9, and 8 more digits."
            )
        return cleaned


class UserCreate(UserBase):
    """Schema for creating a new user (registration)."""
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Ensure password has minimum complexity."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user. All fields optional."""
    phone_number: str | None = None
    full_name: str | None = None
    gender: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    """Schema for user response (never includes password)."""
    id: int
    phone_number: str
    full_name: str
    gender: str | None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
