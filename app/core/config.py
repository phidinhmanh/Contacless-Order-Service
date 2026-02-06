from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=True,
    )

    PROJECT_NAME: str = "Contacless Order Service"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/contacless_order"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # VietQR Configuration
    VIETQR_BANK_ID: str = "mbbank"  # Bank identifier (mbbank, vietcombank, techcombank, etc.)
    VIETQR_ACCOUNT_NO: str = ""  # Restaurant's bank account number
    VIETQR_ACCOUNT_NAME: str = ""  # Account holder name for display
    VIETQR_TEMPLATE: str = "compact2"  # QR template style
    CORS_ORIGINS: str = "*"  # Comma-separated list of allowed origins
    # Casso Webhook Configuration
    CASSO_API_KEY: str = ""  # API key from Casso.vn
    CASSO_WEBHOOK_SECRET: str = ""  # Secret for webhook signature validation
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

settings = get_settings()

