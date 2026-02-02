from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.payment import Payment
from app.models.user import User, UserRole
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
    PaymentStatus,
    PaymentStatusResponse,
    WebhookPayload,
)
from app.services.payment_service import PaymentService

router = APIRouter()


@router.post("/initiate", response_model=PaymentResponse, status_code=201)
def initiate_payment(
    payment_in: PaymentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Initiate a new payment for an order.
    Payment expires after 15 minutes if not completed.
    """
    payment_service = PaymentService(db)
    return payment_service.initiate_payment(payment_in)


@router.post("/webhook", response_model=PaymentResponse)
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


@router.get("/{payment_id}", response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get payment status by ID."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Build status message
    status_messages = {
        PaymentStatus.PENDING.value: "Payment is awaiting processing",
        PaymentStatus.PROCESSING.value: "Payment is being processed",
        PaymentStatus.COMPLETED.value: "Payment completed successfully",
        PaymentStatus.FAILED.value: "Payment failed",
        PaymentStatus.REFUNDED.value: "Payment has been refunded",
        PaymentStatus.CANCELLED.value: "Payment was cancelled",
    }

    return PaymentStatusResponse(
        payment_id=payment.id,
        order_id=payment.order_id,
        status=PaymentStatus(payment.status),
        amount=payment.amount,
        provider=payment.provider,
        message=status_messages.get(payment.status, "Unknown status"),
    )


@router.get("/order/{order_id}", response_model=list[PaymentResponse])
def get_order_payments(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all payments for a specific order."""
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    return payments


@router.post("/check-expired", response_model=dict)
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
        "expired_count": len(expired),
        "expired_payment_ids": [p.id for p in expired],
    }
