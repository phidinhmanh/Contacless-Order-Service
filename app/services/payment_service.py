"""
Payment service with business logic for payment processing.
Implements idempotent webhook handling and automatic rollback.
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import PaymentCreate, WebhookPayload

PAYMENT_TIMEOUT_MINUTES = 15


class PaymentService:
    """Service class for payment-related business logic."""

    def __init__(self, db: Session):
        self.db = db

    def initiate_payment(self, payment_in: PaymentCreate) -> Payment:
        """
        Initiate a new payment for an order.
        Sets 15-minute expiration for timeout handling.
        """
        # Validate order exists and is in valid state
        order = self.db.query(Order).filter(Order.id == payment_in.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.status not in ["pending", "confirmed"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot create payment for order with status '{order.status}'"
            )

        # Check for existing pending payment
        existing = self.db.query(Payment).filter(
            Payment.order_id == payment_in.order_id,
            Payment.status == PaymentStatus.PENDING.value
        ).first()

        if existing:
            # Return existing pending payment instead of creating duplicate
            return existing

        # Create payment with 15-minute timeout
        payment = Payment(
            order_id=payment_in.order_id,
            amount=payment_in.amount,
            provider=payment_in.provider.value,
            status=PaymentStatus.PENDING.value,
            expires_at=datetime.now(UTC) + timedelta(minutes=PAYMENT_TIMEOUT_MINUTES),
        )

        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)

        return payment

    def process_webhook(self, payload: WebhookPayload) -> Payment:
        """
        Process payment webhook from provider.
        IDEMPOTENT: Uses transaction_id to prevent duplicate processing.
        """
        # Check for existing payment with this transaction_id (idempotency)
        existing = self.db.query(Payment).filter(
            Payment.transaction_id == payload.transaction_id
        ).first()

        if existing:
            # Already processed - return existing payment (idempotent)
            return existing

        # Find payment by order_id if transaction_id is new
        payment = None
        if payload.order_id:
            payment = self.db.query(Payment).filter(
                Payment.order_id == payload.order_id,
                Payment.status == PaymentStatus.PENDING.value
            ).first()

        if not payment:
            # Create new payment record for this webhook
            payment = Payment(
                order_id=payload.order_id,
                amount=payload.amount,
                provider=payload.provider,
                status=PaymentStatus.PROCESSING.value,
            )
            self.db.add(payment)

        # Update payment with provider response
        payment.transaction_id = payload.transaction_id

        # Map provider status to our status
        new_status = self._map_provider_status(payload.status)
        payment.status = new_status.value

        if new_status == PaymentStatus.COMPLETED:
            payment.completed_at = datetime.now(UTC)
            # Update order status
            if payment.order_id:
                order = self.db.query(Order).filter(Order.id == payment.order_id).first()
                if order:
                    order.status = "paid"

        elif new_status == PaymentStatus.FAILED:
            # Automatic rollback - reset order to pending
            if payment.order_id:
                order = self.db.query(Order).filter(Order.id == payment.order_id).first()
                if order:
                    order.status = "pending"

        self.db.commit()
        self.db.refresh(payment)

        return payment

    def _map_provider_status(self, provider_status: str) -> PaymentStatus:
        """Map provider-specific status to our PaymentStatus enum."""
        status_map = {
            # Generic mappings
            "success": PaymentStatus.COMPLETED,
            "completed": PaymentStatus.COMPLETED,
            "paid": PaymentStatus.COMPLETED,
            "failed": PaymentStatus.FAILED,
            "failure": PaymentStatus.FAILED,
            "cancelled": PaymentStatus.CANCELLED,
            "canceled": PaymentStatus.CANCELLED,
            "refunded": PaymentStatus.REFUNDED,
            "pending": PaymentStatus.PENDING,
            "processing": PaymentStatus.PROCESSING,
        }
        return status_map.get(provider_status.lower(), PaymentStatus.PENDING)

    def get_payment_status(self, payment_id: int) -> Payment | None:
        """Get payment by ID."""
        return self.db.query(Payment).filter(Payment.id == payment_id).first()

    def check_expired_payments(self) -> list[Payment]:
        """
        Find and mark expired payments as failed.
        Should be run periodically (e.g., every minute by a scheduler).
        """
        now = datetime.now(UTC)
        expired = self.db.query(Payment).filter(
            Payment.status == PaymentStatus.PENDING.value,
            Payment.expires_at < now
        ).all()

        for payment in expired:
            payment.status = PaymentStatus.FAILED.value
            # Rollback order
            if payment.order_id:
                order = self.db.query(Order).filter(Order.id == payment.order_id).first()
                if order:
                    order.status = "pending"

        if expired:
            self.db.commit()

        return expired
