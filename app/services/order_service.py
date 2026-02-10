"""
Order business logic service.
Handles complex order operations that involve multiple models.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case
from app.models.food import Food
from app.models.order import Order, OrderItem, OrderStatus
from app.models.table import Table
from app.models.user import User
from app.schemas.order import OrderCreate


class OrderService:
    """Service class for order-related business logic."""

    def __init__(self, db: Session):
        self.db = db

    def _get_order_with_items(self, order_id: int) -> Order | None:
        """Helper to get order with eager-loaded relationships."""
        return (
            self.db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.food))
            .filter(Order.id == order_id)
            .first()
        )

    def create_order(self, order_in: OrderCreate, user_id: int | None = None) -> Order:
        """
        Create a new order with items.
        Validates user, table, and food items exist.
        Calculates total price automatically.
        """
        # Use provided user_id or fall back to schema
        effective_user_id = user_id or order_in.user_id

        # Validate user exists if provided
        if effective_user_id is not None:
            user = self.db.query(User).filter(User.id == effective_user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

        # Validate table exists
        table = self.db.query(Table).filter(Table.id == order_in.table_id).first()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        # Create order
        if order_in.idempotency_key:
            existing_order = self.db.query(Order).filter(
                Order.idempotency_key == order_in.idempotency_key
            ).first()
            if existing_order:
                # Return existing order if idempotency key matches (idempotent)
                return existing_order

        order = Order(
            user_id=effective_user_id,
            table_id=order_in.table_id,
            table_session_id=order_in.table_session_id,
            status="pending",
            payment_status="unpaid",
            idempotency_key=order_in.idempotency_key,
            special_instructions=order_in.special_instructions,
        )
        self.db.add(order)
        self.db.flush()  # Get order ID without committing

        total_price = 0.0

        # Create order items and calculate total (with Row Locking for Race Conditions)
        for item_data in order_in.items:
            # Query food with Row Locking (FOR UPDATE)
            food = (
                self.db.query(Food)
                .filter(Food.id == item_data.food_id)
                .with_for_update()  # Prevent TC-ORDER-06 Race Condition
                .first()
            )

            if not food:
                raise HTTPException(
                    status_code=404,
                    detail=f"Food with id {item_data.food_id} not found"
                )

            # Check stock/availability
            if not food.is_available or (food.stock_quantity is not None and food.stock_quantity < item_data.quantity):
                raise HTTPException(
                    status_code=400,
                    detail=f"Food '{food.name}' is sold out or has insufficient stock"
                )

            # Update stock atomically when tracking inventory
            if food.stock_quantity is not None:
                updated = (
                    self.db.query(Food)
                    .filter(
                        Food.id == food.id,
                        Food.stock_quantity >= item_data.quantity,
                    )
                    .update(
                        {
                            Food.stock_quantity: Food.stock_quantity - item_data.quantity,
                            Food.is_available: case(
                                ((Food.stock_quantity - item_data.quantity) <= 0, False),
                                else_=Food.is_available,
                            ),
                        },
                        synchronize_session=False,
                    )
                )

                if updated == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Food '{food.name}' is sold out or has insufficient stock"
                    )

                self.db.flush()
                self.db.refresh(food)

            order_item = OrderItem(
                order_id=order.id,
                food_id=item_data.food_id,
                quantity=item_data.quantity,
                unit_price=food.price,  # Use price at time of order
            )
            self.db.add(order_item)
            total_price += food.price * item_data.quantity

        # Update order total price
        order.total_price = total_price

        self.db.commit()
        self.db.refresh(order)

        return order

    def cancel_order(self, order_id: int, user_id: int | None) -> Order:
        """
        Cancel an order if within 2 minutes of creation.
        Restores food stock if cancelled successfully.
        """
        from datetime import UTC, datetime
        order = self._get_order_with_items(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Check ownership (skip for guest orders where both are None)
        if order.user_id is not None and order.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

        # Check cancellation window (2 minutes)
        now = datetime.now(UTC)
        # Handle timezone-naive datetime from database
        created_at = order.created_at.replace(tzinfo=UTC) if order.created_at.tzinfo is None else order.created_at
        if (now - created_at).total_seconds() > 120:
            raise HTTPException(
                status_code=400,
                detail="Cancellation window (2 minutes) has expired. Please contact staff."
            )

        # Check if already processed
        if order.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel order with status: {order.status}"
            )

        # Restore stock using with_for_update to be safe
        for item in order.items:
            food = self.db.query(Food).filter(Food.id == item.food_id).with_for_update().first()
            if food and food.stock_quantity is not None:
                food.stock_quantity += item.quantity
                food.is_available = True

        order.status = "cancelled"
        order.payment_status = "unpaid"
        self.db.commit()
        self.db.refresh(order)

        return order

    def advance_order_status(self, order_id: int) -> Order:
        """
        Advance order status to the next logical state.
        PENDING -> CONFIRMED -> PREPARING -> READY -> COMPLETED
        """
        order = self._get_order_with_items(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        next_status = OrderStatus.get_next_status(order.status)
        if not next_status:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot advance order from status: {order.status}"
            )

        order.status = next_status
        self.db.commit()
        self.db.refresh(order)

        return order

    def mark_order_as_paid(self, order_id: int) -> Order:
        """
        Manually mark an order as paid by an admin.
        Updates both order status and creates a completed payment record.
        """
        from datetime import UTC, datetime
        from app.models.payment import Payment, PaymentStatus

        order = self._get_order_with_items(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.payment_status == "paid":
            return order

        # Create a manual payment record
        payment = Payment(
            order_id=order.id,
            amount=order.total_price,
            provider="manual",
            status=PaymentStatus.COMPLETED.value,
            transaction_id=f"MANUAL-{order.id}-{int(datetime.now(UTC).timestamp())}",
            completed_at=datetime.now(UTC),
        )
        self.db.add(payment)

        # Update order status
        order.status = "paid"
        order.payment_status = "paid"

        self.db.commit()
        self.db.refresh(order)

        return order
