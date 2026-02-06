from sqlalchemy import Column, Integer, Boolean, String
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base


class Table(Base):
    __tablename__ = "tables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    table_number: Mapped[int] = mapped_column(Integer, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False)
    qr_code_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    orders = relationship("Order", back_populates="table")

