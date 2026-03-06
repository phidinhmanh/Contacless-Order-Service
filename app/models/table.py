from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Table(Base):
    __tablename__ = 'tables'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    table_number: Mapped[int] = mapped_column(Integer, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False)
    qr_code_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qr_token: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )  # Rotating security token
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    orders = relationship('Order', back_populates='table')
