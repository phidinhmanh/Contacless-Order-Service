from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.models.base import Base


class AuditLog(Base):
    """
    Audit log for tracking important actions.
    Used for compliance, debugging, and security monitoring.
    """

    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)

    # What was affected
    entity_type = Column(
        String(50), nullable=False, index=True
    )  # e.g., "order", "user", "payment"
    entity_id = Column(Integer, nullable=True, index=True)

    # What happened
    action = Column(
        String(50), nullable=False, index=True
    )  # e.g., "create", "update", "delete", "cancel"

    # Change details (stored as JSON strings)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    # Who did it
    user_id = Column(
        Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True
    )
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(255), nullable=True)

    # When
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)
