from pydantic import BaseModel, Field


class Token(BaseModel):
    """JWT token response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Decoded JWT token payload."""
    sub: str  # Subject (user ID)
    exp: int  # Expiration timestamp
    type: str  # Token type (access/refresh)


class LoginRequest(BaseModel):
    """Login credentials schema."""
    phone_number: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=1)


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    refresh_token: str

class GuestLoginRequest(BaseModel):
    """Guest login request schema."""
    table_id: int | None = None