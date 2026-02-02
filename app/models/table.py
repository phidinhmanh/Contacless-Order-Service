from sqlalchemy import Column, Integer, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base

class Table(Base):
    __tablename__ = "tables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    table_number: Mapped[int] = mapped_column(Integer, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False)

    orders = relationship("Order", back_populates="table")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
