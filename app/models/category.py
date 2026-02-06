from datetime import datetime, UTC

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Category(Base):
    """Food category for menu organization."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0)  # For UI ordering
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    # Relationships
    foods = relationship("Food", back_populates="category")
