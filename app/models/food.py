from datetime import datetime, UTC

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    price = Column(Float, nullable=False)
    category = Column(String(50), index=True)
    is_available = Column(Boolean, default=True)
    description = Column(String(500), nullable=True)

    # TC-ORDER-06: The "Last Plate" Problem fix
    stock_quantity = Column(Integer, default=0, nullable=True)  # Nullable means infinite/untracked

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    order_items = relationship("OrderItem", back_populates="food")
