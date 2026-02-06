"""
Analytics service for business intelligence.
Provides revenue summaries, peak hour analysis, and customer insights.
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List

import pytz
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.order import Order, OrderItem, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.models.table_session import TableSession

# Vietnam timezone for local time conversions
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')


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
        Uses PAID orders (not COMPLETED) for accurate revenue tracking.
        """
        if not start_date:
            start_date = datetime.now(UTC) - timedelta(hours=24)
        if not end_date:
            end_date = datetime.now(UTC)

        # Get PAID and COMPLETED orders in date range for revenue calculation
        orders = self.db.query(Order).filter(
            Order.created_at >= start_date,
            Order.created_at <= end_date,
            Order.status.in_([OrderStatus.CONFIRMED.value, OrderStatus.COMPLETED.value]),
        ).all()

        total_revenue = sum(o.total_price for o in orders if o.total_price)
        order_count = len(orders)
        avg_order_value = total_revenue / order_count if order_count > 0 else 0

        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "total_revenue": round(total_revenue, 2),
            "order_count": order_count,
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
        Converts to Vietnam timezone for accurate local peak hours.
        """
        start_date = datetime.now(UTC) - timedelta(days=days)

        orders = self.db.query(Order).filter(
            Order.created_at >= start_date,
        ).all()

        # Group by hour and half-hour (in Vietnam timezone)
        time_slots: Dict[str, int] = {}
        for order in orders:
            if order.created_at:
                # Convert UTC to Vietnam time for accurate local peak hours
                utc_time = order.created_at.replace(tzinfo=pytz.UTC)
                local_time = utc_time.astimezone(VIETNAM_TZ)
                hour = local_time.hour
                minute_slot = 0 if local_time.minute < 30 else 30
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
        Analyze new vs returning customers based on visits (TableSessions).
        A returning customer has visited in more than 1 session.
        """
        # Count sessions per user (Inner join ensures we only count users who started a session)
        user_session_counts = self.db.query(
            User.id,
            func.count(TableSession.id).label("session_count")
        ).join(TableSession, User.id == TableSession.lead_user_id).group_by(User.id).all()

        new_customers = sum(1 for _, count in user_session_counts if count == 1)
        returning_customers = sum(1 for _, count in user_session_counts if count > 1)
        total_customers = len(user_session_counts)

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

        orders = self.db.query(Order).filter(
            Order.status.in_([OrderStatus.PAID.value, OrderStatus.COMPLETED.value]),
            Order.created_at >= start_date,
        ).all()

        # Group by date (in Vietnam timezone for consistency)
        daily_revenue: Dict[str, float] = {}
        for order in orders:
            utc_time = order.created_at.replace(tzinfo=pytz.UTC)
            local_time = utc_time.astimezone(VIETNAM_TZ)
            date_key = local_time.strftime("%Y-%m-%d")
            daily_revenue[date_key] = daily_revenue.get(date_key, 0) + (order.total_price or 0)

        return [
            {"date": k, "revenue": round(v, 2)}
            for k, v in sorted(daily_revenue.items())
        ]

    def get_retention_data(self) -> Dict[str, Any]:
        """
        Calculate customer retention over 14 and 30 day windows.
        
        CORRECT LOGIC:
        1. Find users who had at least 1 order BEFORE the window (eligible to return)
        2. Of those, count how many ordered WITHIN the window (returning)
        3. Retention Rate = returning / eligible * 100
        """
        now = datetime.now(UTC)
        windows = [14, 30]
        retention = {}

        for days in windows:
            window_start = now - timedelta(days=days)
            
            # Step 1: Users who had at least 1 order BEFORE the window (eligible to return)
            historical_user_ids = self.db.query(Order.user_id).filter(
                Order.created_at < window_start,
                Order.user_id.isnot(None)
            ).distinct().all()
            
            eligible_user_ids = [u[0] for u in historical_user_ids]
            total_eligible = len(eligible_user_ids)
            
            if total_eligible == 0:
                retention[f"rate_{days}d"] = 0.0
                retention[f"returning_users_{days}d"] = 0
                retention[f"eligible_users_{days}d"] = 0
                continue
            
            # Step 2: Of those eligible, how many ordered WITHIN the window?
            returning_users = self.db.query(Order.user_id).filter(
                Order.created_at >= window_start,
                Order.user_id.in_(eligible_user_ids)
            ).distinct().count()

            retention[f"rate_{days}d"] = round(
                (returning_users / total_eligible * 100), 2
            )
            retention[f"returning_users_{days}d"] = returning_users
            retention[f"eligible_users_{days}d"] = total_eligible

        return retention

    def get_inventory_alerts(self, threshold_hours: int = 24) -> List[Dict[str, Any]]:
        """
        Predictive Inventory Alerts.
        Uses 7-day average velocity for more stable predictions.
        """
        now = datetime.now(UTC)
        last_7d = now - timedelta(days=7)

        # Calculate velocity (items per hour) - 7-day average for stability
        velocity_subquery = (
            self.db.query(
                OrderItem.food_id,
                (func.sum(OrderItem.quantity) / (7.0 * 24)).label("velocity")
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.created_at >= last_7d)
            .group_by(OrderItem.food_id)
            .subquery()
        )

        # Get foods with stock tracking enabled
        foods = self.db.query(Food, velocity_subquery.c.velocity).outerjoin(
            velocity_subquery, Food.id == velocity_subquery.c.food_id
        ).filter(Food.stock_quantity.isnot(None)).all()

        alerts = []
        for food, velocity in foods:
            # Handle None stock safely
            stock = food.stock_quantity or 0
            velocity = velocity or 0.05  # Assume low velocity if no recent orders
            hours_left = stock / velocity if velocity > 0 else 999

            if hours_left < threshold_hours or stock < 10:
                alerts.append({
                    "food_id": food.id,
                    "food_name": food.name,
                    "current_stock": stock,
                    "velocity_per_hour": round(velocity, 3),
                    "estimated_hours_remaining": round(hours_left, 1) if hours_left < 999 else "Stable",
                    "priority": "HIGH" if hours_left < 6 else ("MEDIUM" if hours_left < 24 else "LOW")
                })

        return sorted(
            alerts, 
            key=lambda x: x["estimated_hours_remaining"] if isinstance(x["estimated_hours_remaining"], (int, float)) else 999
        )

    def get_table_revenue(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Analyze revenue and popularity by table.
        Identify the most profitable locations in the restaurant.
        """
        start_date = datetime.now(UTC) - timedelta(days=days)

        # Get orders with payments grouped by table
        results = self.db.query(
            Order.table_id,
            func.sum(Order.total_price).label("total_revenue"),
            func.count(Order.id).label("order_count")
        ).filter(
            Order.created_at >= start_date,
            Order.status.in_([OrderStatus.PAID.value, OrderStatus.COMPLETED.value]),
            Order.table_id.isnot(None)
        ).group_by(Order.table_id).all()

        table_data = []
        for table_id, total_revenue, order_count in results:
            avg_order = total_revenue / order_count if order_count > 0 else 0
            table_data.append({
                "table_id": table_id,
                "total_revenue": round(total_revenue or 0, 2),
                "order_count": order_count,
                "avg_order_value": round(avg_order, 2)
            })

        return sorted(table_data, key=lambda x: x["total_revenue"], reverse=True)

    def get_popular_items(self, days: int = 30, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get most popular food items by quantity sold.
        """
        start_date = datetime.now(UTC) - timedelta(days=days)

        # Aggregate OrderItems for PAID/COMPLETED orders
        # Aggregate OrderItems for PAID/COMPLETED orders
        results = self.db.query(
            Food.name,
            func.sum(OrderItem.quantity).label("total_quantity"),
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("total_revenue")
        ).join(Order).join(Food, OrderItem.food_id == Food.id).filter(
            Order.created_at >= start_date,
            Order.status.in_([OrderStatus.PAID.value, OrderStatus.COMPLETED.value])
        ).group_by(Food.name).order_by(func.sum(OrderItem.quantity).desc()).limit(limit).all()

        return [
            {
                "food_name": name,
                "quantity": int(qty),
                "revenue": float(revenue)
            }
            for name, qty, revenue in results
        ]
