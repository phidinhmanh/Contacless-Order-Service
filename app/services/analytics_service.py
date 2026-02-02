"""
Analytics service for business intelligence.
Provides revenue summaries, peak hour analysis, and customer insights.
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.payment import Payment, PaymentStatus
from app.models.user import User


class AnalyticsService:
    """Service for analytics and reporting."""

    def __init__(self, db: Session):
        self.db = db

    def get_revenue_summary(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> Dict[str, Any]:
        """
        Get revenue summary for a date range.
        Defaults to last 24 hours if no dates provided.
        """
        if not start_date:
            start_date = datetime.now(UTC) - timedelta(hours=24)
        if not end_date:
            end_date = datetime.now(UTC)

        # Get completed payments in date range
        payments = self.db.query(Payment).filter(
            Payment.status == PaymentStatus.COMPLETED.value,
            Payment.completed_at >= start_date,
            Payment.completed_at <= end_date,
        ).all()

        # Get orders in date range
        orders = self.db.query(Order).filter(
            Order.created_at >= start_date,
            Order.created_at <= end_date,
        ).all()

        total_revenue = sum(p.amount for p in payments)
        order_count = len(orders)
        payment_count = len(payments)
        avg_order_value = total_revenue / payment_count if payment_count > 0 else 0

        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "total_revenue": round(total_revenue, 2),
            "order_count": order_count,
            "completed_payments": payment_count,
            "average_order_value": round(avg_order_value, 2),
            "currency": "VND",
        }

    def get_peak_hours(
        self,
        days: int = 7,
        interval_minutes: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Analyze peak hours based on order volume.
        Groups by 30-minute intervals by default.
        """
        start_date = datetime.now(UTC) - timedelta(days=days)

        orders = self.db.query(Order).filter(
            Order.created_at >= start_date,
        ).all()

        # Group by hour and half-hour
        time_slots: Dict[str, int] = {}
        for order in orders:
            if order.created_at:
                hour = order.created_at.hour
                minute_slot = 0 if order.created_at.minute < 30 else 30
                slot_key = f"{hour:02d}:{minute_slot:02d}"
                time_slots[slot_key] = time_slots.get(slot_key, 0) + 1

        # Sort by order count descending
        sorted_slots = sorted(
            [{"time_slot": k, "order_count": v} for k, v in time_slots.items()],
            key=lambda x: x["order_count"],
            reverse=True,
        )

        return sorted_slots

    def get_customer_segments(self) -> Dict[str, Any]:
        """
        Analyze new vs returning customers.
        A returning customer has more than 1 order.
        """
        # Count orders per user
        user_order_counts = self.db.query(
            User.id,
            func.count(Order.id).label("order_count")
        ).outerjoin(Order).group_by(User.id).all()

        new_customers = sum(1 for _, count in user_order_counts if count == 1)
        returning_customers = sum(1 for _, count in user_order_counts if count > 1)
        total_customers = len(user_order_counts)

        return {
            "total_customers": total_customers,
            "new_customers": new_customers,
            "returning_customers": returning_customers,
            "retention_rate": round(
                (returning_customers / total_customers * 100) if total_customers > 0 else 0, 2
            ),
        }

    def get_daily_revenue(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get daily revenue for charting."""
        start_date = datetime.now(UTC) - timedelta(days=days)

        payments = self.db.query(Payment).filter(
            Payment.status == PaymentStatus.COMPLETED.value,
            Payment.completed_at >= start_date,
        ).all()

        # Group by date
        daily_revenue: Dict[str, float] = {}
        for payment in payments:
            if payment.completed_at:
                date_key = payment.completed_at.strftime("%Y-%m-%d")
                daily_revenue[date_key] = daily_revenue.get(date_key, 0) + payment.amount

        return [
            {"date": k, "revenue": round(v, 2)}
            for k, v in sorted(daily_revenue.items())
        ]

    def get_retention_data(self) -> Dict[str, Any]:
        """
        Calculate customer retention over 14 and 30 day windows.
        #1 metric for Sơn's growth logic.
        """
        now = datetime.now(UTC)
        windows = [14, 30]
        retention = {}

        for days in windows:
            start_date = now - timedelta(days=days)
            # Users who ordered in the window
            active_users = self.db.query(Order.user_id).filter(
                Order.created_at >= start_date
            ).distinct().all()

            # Users who had at least 1 order BEFORE the window
            returning_users = self.db.query(Order.user_id).filter(
                Order.created_at < start_date,
                Order.user_id.in_([u[0] for u in active_users])
            ).distinct().count()

            total_historical = self.db.query(User).filter(
                User.created_at < start_date
            ).count()

            retention[f"rate_{days}d"] = round(
                (returning_users / total_historical * 100) if total_historical > 0 else 0, 2
            )
            retention[f"returning_users_{days}d"] = returning_users

        return retention

    def get_inventory_alerts(self, threshold_hours: int = 24) -> List[Dict[str, Any]]:
        """
        Predictive Inventory Alerts.
        Compares current stock vs order velocity in the last 24h.
        """
        from app.models.food import Food
        from app.models.order import OrderItem

        now = datetime.now(UTC)
        last_24h = now - timedelta(hours=24)

        # Calculate velocity (items per hour)
        velocity_subquery = (
            self.db.query(
                OrderItem.food_id,
                (func.sum(OrderItem.quantity) / 24.0).label("velocity")
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.created_at >= last_24h)
            .group_by(OrderItem.food_id)
            .subquery()
        )

        # Get foods with low stock relative to velocity
        foods = self.db.query(Food, velocity_subquery.c.velocity).outerjoin(
            velocity_subquery, Food.id == velocity_subquery.c.food_id
        ).filter(Food.stock_quantity != None).all()

        alerts = []
        for food, velocity in foods:
            velocity = velocity or 0.05  # Assume low velocity if no orders
            hours_left = food.stock_quantity / velocity if velocity > 0 else 999

            if hours_left < threshold_hours or food.stock_quantity < 10:
                alerts.append({
                    "food_id": food.id,
                    "food_name": food.name,
                    "current_stock": food.stock_quantity,
                    "velocity_per_hour": round(velocity, 2),
                    "estimated_hours_remaining": round(hours_left, 1) if hours_left < 999 else "Stable",
                    "priority": "HIGH" if hours_left < 6 else "MEDIUM"
                })

        return sorted(alerts, key=lambda x: x["estimated_hours_remaining"] if isinstance(x["estimated_hours_remaining"], (int, float)) else 999)
