"""
Payment service with business logic for payment processing.
Implements idempotent webhook handling and automatic rollback.
"""

import re
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.websocket import manager
from app.models.order import Order
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import CassoWebhookPayload, PaymentCreate, WebhookPayload

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
            raise HTTPException(status_code=404, detail='Order not found')

        # Check for existing pending payment
        existing = (
            self.db.query(Payment)
            .filter(
                Payment.order_id == payment_in.order_id,
                Payment.status == PaymentStatus.PENDING.value,
            )
            .first()
        )

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
        existing = (
            self.db.query(Payment)
            .filter(Payment.transaction_id == payload.transaction_id)
            .first()
        )

        if existing:
            # Already processed - return existing payment (idempotent)
            return existing

        # Find payment by order_id if transaction_id is new
        payment = None
        if payload.order_id:
            payment = (
                self.db.query(Payment)
                .filter(
                    Payment.order_id == payload.order_id,
                    Payment.status == PaymentStatus.PENDING.value,
                )
                .first()
            )

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
                order = (
                    self.db.query(Order).filter(Order.id == payment.order_id).first()
                )
                if order:
                    order.status = 'paid'
                    order.payment_status = 'paid'

        elif new_status == PaymentStatus.FAILED:
            # Automatic rollback - reset order to pending
            if payment.order_id:
                order = (
                    self.db.query(Order).filter(Order.id == payment.order_id).first()
                )
                if order:
                    order.status = 'pending'
                    order.payment_status = 'failed'

        self.db.commit()
        self.db.refresh(payment)

        return payment

    def _map_provider_status(self, provider_status: str) -> PaymentStatus:
        """Map provider-specific status to our PaymentStatus enum."""
        status_map = {
            # Generic mappings
            'success': PaymentStatus.COMPLETED,
            'completed': PaymentStatus.COMPLETED,
            'paid': PaymentStatus.COMPLETED,
            'failed': PaymentStatus.FAILED,
            'failure': PaymentStatus.FAILED,
            'cancelled': PaymentStatus.CANCELLED,
            'canceled': PaymentStatus.CANCELLED,
            'refunded': PaymentStatus.REFUNDED,
            'pending': PaymentStatus.PENDING,
            'processing': PaymentStatus.PROCESSING,
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
        expired = (
            self.db.query(Payment)
            .filter(
                Payment.status == PaymentStatus.PENDING.value, Payment.expires_at < now
            )
            .all()
        )

        for payment in expired:
            payment.status = PaymentStatus.FAILED.value
            # Rollback order
            if payment.order_id:
                order = (
                    self.db.query(Order).filter(Order.id == payment.order_id).first()
                )
                if order:
                    order.status = 'pending'
                    order.payment_status = 'failed'

        if expired:
            self.db.commit()

        return expired

    def generate_vietqr_url(self, order_id: int, amount: float) -> dict:
        """
        Generate a VietQR image URL with pre-filled amount and transfer content.
        The VietQR.io API is free and requires no authentication.
        """
        # Build transfer content with order ID for tracking
        transfer_content = f'THANH TOAN DON OC_{order_id}'

        # URL encode the description for safe URL building
        encoded_content = quote(transfer_content)

        # Build VietQR URL
        # Format: https://img.vietqr.io/image/<BANK_ID>-<ACC_NO>-<TEMPLATE>.png
        qr_url = (
            f'https://img.vietqr.io/image/'
            f'{settings.VIETQR_BANK_ID}-{settings.VIETQR_ACCOUNT_NO}-{settings.VIETQR_TEMPLATE}.png'
            f'?amount={int(amount)}&addInfo={encoded_content}'
        )

        return {
            'qr_url': qr_url,
            'bank_id': settings.VIETQR_BANK_ID,
            'account_no': settings.VIETQR_ACCOUNT_NO,
            'account_name': settings.VIETQR_ACCOUNT_NAME,
            'transfer_content': transfer_content,
        }

    def _extract_order_id(self, description: str) -> int | None:
        """
        Extract order ID from bank transfer description.
        Expected format: "THANH TOAN DON OC_<order_id>"
        Also handles variations like "OC_123" appearing anywhere in the text.
        """
        # Try to find OC_<digits> pattern
        match = re.search(r'OC_(\d+)', description, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return None

    def _extract_sender_name(self, description: str) -> str | None:
        """
        Heuristic to extract sender name from description.
        Bank descriptions often format as: "DATA... <NAME> chuyen khoan..." or just content.
        For now, we just clean up the description removing the order ID part.
        This is a best-effort approach.
        """
        # Remove the OC_123 part
        cleaned = re.sub(r'OC_\d+', '', description, flags=re.IGNORECASE)
        # Remove common prefixes/suffixes
        cleaned = re.sub(r'THANH TOAN DON', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'CHUYEN KHOAN', '', cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip()

        # If what remains is reasonably short and looks like a name, return it
        if 3 < len(cleaned) < 50:
            return cleaned.title()
        return None

    async def process_casso_webhook(
        self, payload: CassoWebhookPayload
    ) -> list[Payment]:
        """
        Process Casso webhook containing bank transfer notifications.
        Automatically matches transfers to orders based on description content.

        Returns list of updated payments.
        """
        if payload.error != 0:
            raise HTTPException(
                status_code=400, detail=f'Casso webhook error: {payload.error}'
            )

        updated_payments = []

        for transaction in payload.data:
            # Extract order ID from description
            order_id = self._extract_order_id(transaction.description)
            if not order_id:
                # Cannot match to order, skip this transaction
                continue

            # Check if already processed (idempotency via transaction ID)
            existing = (
                self.db.query(Payment)
                .filter(Payment.transaction_id == transaction.id)
                .first()
            )
            if existing:
                updated_payments.append(existing)
                continue

            # Find the order
            order = self.db.query(Order).filter(Order.id == order_id).first()
            if not order:
                continue

            # Validate amount (allow slight differences due to rounding)
            if transaction.amount < order.total_price:
                # Underpaid - do not mark as complete
                continue

            # Attempt to update User name if not set (Lead Guest strategy)
            # This captures the "Verified Data" from the bank transaction
            if order.user:
                sender_name = self._extract_sender_name(transaction.description)
                if sender_name and (
                    not order.user.full_name or 'Guest' in order.user.full_name
                ):
                    order.user.full_name = sender_name
                    # Note: Phone number is not exposed in description usually

            # Find or create payment record
            payment = (
                self.db.query(Payment)
                .filter(
                    Payment.order_id == order_id,
                    Payment.status == PaymentStatus.PENDING.value,
                )
                .first()
            )

            if payment:
                # Update existing pending payment
                payment.transaction_id = transaction.id
                payment.status = PaymentStatus.COMPLETED.value
                payment.completed_at = datetime.now(UTC)
            else:
                # Create new payment record
                payment = Payment(
                    order_id=order_id,
                    amount=transaction.amount,
                    provider='vietqr',
                    status=PaymentStatus.COMPLETED.value,
                    transaction_id=transaction.id,
                    completed_at=datetime.now(UTC),
                )
                self.db.add(payment)

            # Update order status
            order.status = 'paid'
            order.payment_status = 'paid'

            self.db.commit()
            self.db.refresh(payment)
            updated_payments.append(payment)

            # Notify kitchen via WebSocket
            await manager.broadcast(
                {
                    'type': 'payment_confirmed',
                    'order_id': order_id,
                    'message': f'Đơn hàng #{order_id} đã thanh toán!',
                },
                channel='kitchen',
            )

        return updated_payments
