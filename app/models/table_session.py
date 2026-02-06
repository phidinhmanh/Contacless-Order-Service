from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.models.base import Base

class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False, index=True)
    lead_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_count = Column(Integer, default=1)
    status = Column(String(20), default="active")  # active, closed
    
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    closed_at = Column(DateTime, nullable=True)

    # Relationships
    table = relationship("Table", backref="sessions")
    lead_user = relationship("User", backref="lead_sessions")
