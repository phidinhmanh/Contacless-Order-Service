from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.websocket import manager
from app.models.payment import Payment
from app.models.user import User, UserRole
from app.schemas.payment import (
    CassoWebhookPayload,
    PaymentCreate,
    PaymentProvider,
    PaymentResponse,
    PaymentStatus,
    PaymentStatusResponse,
    VietQRResponse,
    WebhookPayload,
)
from app.services.payment_service import PaymentService

router = APIRouter()


@router.post(
    '/initiate', response_model=PaymentResponse | VietQRResponse, status_code=201
)
def initiate_payment(
    payment_in: PaymentCreate,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Initiate a new payment for an order.
    For VietQR: Returns QR code URL with bank details.
    Payment expires after 15 minutes if not completed.
    """
    payment_service = PaymentService(db)
    payment = payment_service.initiate_payment(payment_in)

    # For Cash, notify admin/kitchen immediately
    if payment_in.provider == PaymentProvider.CASH:
        # Get table number if available
        table_number = (
            payment.order.table.table_number
            if payment.order and payment.order.table
            else 'Unknown'
        )

        # Broadcast notification via WebSocket
        message = {
            'type': 'cash_payment_request',
            'table_number': table_number,
            'message': f'Bàn {table_number} thanh toán tiền mặt',
        }
        background_tasks.add_task(manager.broadcast, message, channel='kitchen')

    # For VietQR, enrich response with QR code details
    if payment_in.provider == PaymentProvider.VIETQR:
        vietqr_data = payment_service.generate_vietqr_url(
            order_id=payment.order_id, amount=payment.amount
        )
        return VietQRResponse(
            id=payment.id,
            order_id=payment.order_id,
            amount=payment.amount,
            currency=payment.currency,
            status=PaymentStatus(payment.status),
            provider=payment.provider,
            qr_url=vietqr_data['qr_url'],
            bank_id=vietqr_data['bank_id'],
            account_no=vietqr_data['account_no'],
            account_name=vietqr_data['account_name'],
            transfer_content=vietqr_data['transfer_content'],
            expires_at=payment.expires_at,
        )

    return payment


@router.post('/webhook', response_model=PaymentResponse)
def payment_webhook(
    payload: WebhookPayload,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Webhook endpoint for payment provider callbacks.

    IDEMPOTENT: Safe to call multiple times with same transaction_id.
    Failed payments trigger automatic rollback of order status.
    """
    # TODO: Verify webhook signature based on provider
    # This is critical for production security

    payment_service = PaymentService(db)
    return payment_service.process_webhook(payload)


@router.post('/webhook/casso', response_model=dict)
async def casso_webhook(
    payload: CassoWebhookPayload,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Webhook endpoint for Casso.vn bank transfer notifications.

    When a customer transfers money via VietQR, Casso detects the transfer
    and sends a POST request to this endpoint with transaction details.

    The order ID is extracted from the transfer description (e.g., "THANH TOAN DON OC_123").

    IDEMPOTENT: Safe to call multiple times with same transaction ID.
    Successful payments trigger WebSocket notification to kitchen.
    """
    # TODO: Verify Casso webhook signature in production
    # Header: X-Casso-Signature with HMAC-SHA256

    payment_service = PaymentService(db)
    updated_payments = await payment_service.process_casso_webhook(payload)

    return {
        'status': 'success',
        'processed_count': len(updated_payments),
        'payment_ids': [p.id for p in updated_payments],
    }


@router.get('/{payment_id}', response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get payment status by ID."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    if not payment:
        raise HTTPException(status_code=404, detail='Payment not found')

    # Build status message
    status_messages = {
        PaymentStatus.PENDING.value: 'Payment is awaiting processing',
        PaymentStatus.PROCESSING.value: 'Payment is being processed',
        PaymentStatus.COMPLETED.value: 'Payment completed successfully',
        PaymentStatus.FAILED.value: 'Payment failed',
        PaymentStatus.REFUNDED.value: 'Payment has been refunded',
        PaymentStatus.CANCELLED.value: 'Payment was cancelled',
    }

    return PaymentStatusResponse(
        payment_id=payment.id,
        order_id=payment.order_id,
        status=PaymentStatus(payment.status),
        amount=payment.amount,
        provider=payment.provider,
        message=status_messages.get(payment.status, 'Unknown status'),
    )


@router.get('/order/{order_id}', response_model=list[PaymentResponse])
def get_order_payments(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all payments for a specific order."""
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    return payments


@router.post('/check-expired', response_model=dict)
def check_expired_payments(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """
    Manually trigger check for expired payments.
    In production, this should run via a scheduled job.
    Requires ADMIN or MANAGER role.
    """
    payment_service = PaymentService(db)
    expired = payment_service.check_expired_payments()

    return {
        'expired_count': len(expired),
        'expired_payment_ids': [p.id for p in expired],
    }
