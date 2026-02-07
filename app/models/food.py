from datetime import datetime, UTC

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.models.base import Base


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    price = Column(Float, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    is_available = Column(Boolean, default=True)  # Menu visibility
    is_out_of_stock = Column(Boolean, default=False, server_default="false", nullable=False)  # Temporary unavailability
    description = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)  # URL to food image

    # TC-ORDER-06: The "Last Plate" Problem fix
    stock_quantity = Column(Integer, default=0, nullable=True)  # Nullable means infinite/untracked

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    # Relationships
    category = relationship("Category", back_populates="foods")
    order_items = relationship("OrderItem", back_populates="food")
