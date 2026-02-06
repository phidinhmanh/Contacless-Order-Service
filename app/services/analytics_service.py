import pytz
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List
from sqlalchemy import func, text, case
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.order import Order, OrderItem, OrderStatus
from app.models.table_session import TableSession

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.tz = "Asia/Ho_Chi_Minh"
        self.valid_statuses = [
            OrderStatus.PAID.value,
            OrderStatus.CONFIRMED.value,
            OrderStatus.COMPLETED.value
        ]

    def get_revenue_summary(self, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        if not start_date:
            now_vn = datetime.now(UTC).astimezone(pytz.timezone(self.tz))
            start_date = now_vn.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)
        end_date = end_date or datetime.now(UTC)

        res = self.db.query(
            func.sum(Order.total_price).label("revenue"),
            func.count(Order.id).label("count")
        ).filter(
            Order.created_at.between(start_date, end_date),
            Order.status.in_(self.valid_statuses)
        ).first()

        rev = float(res.revenue or 0)
        count = int(res.count or 0)

        return {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "total_revenue": round(rev, 2),
            "order_count": count,
            "average_order_value": round(rev / count, 2) if count > 0 else 0,
            "currency": "VND"
        }

    def get_customer_segments(self) -> Dict[str, Any]:
        """Fixed raw SQL using double quotes for aliases and .mappings() to prevent NoSuchColumnError."""
        sql = text("""
            SELECT 
                COUNT(id) as total_sessions,
                COUNT(DISTINCT lead_user_id) FILTER (WHERE lead_user_id IS NOT NULL) as unique_auth_users,
                COUNT(id) FILTER (WHERE lead_user_id IS NULL) as anon_sessions,
                (SELECT COUNT(*) FROM (
                    SELECT lead_user_id FROM table_sessions 
                    WHERE lead_user_id IS NOT NULL 
                    GROUP BY lead_user_id HAVING COUNT(id) > 1
                ) as sub_retention) as returning_count
            FROM table_sessions
        """)
        
        # .mappings() is the key to fixing your "NoSuchColumnError"
        res = self.db.execute(sql).mappings().first()
        
        total_customers = (res['unique_auth_users'] or 0) + (res['anon_sessions'] or 0)
        returning = res['returning_count'] or 0
        new_customers = total_customers - returning

        return {
            "total_customers": total_customers,
            "new_customers": new_customers,
            "returning_customers": returning,
            "retention_rate": round((returning / total_customers * 100), 2) if total_customers > 0 else 0
        }

    def get_popular_items(self, days: int = 30, limit: int = 10) -> List[Dict[str, Any]]:
        start = datetime.now(UTC) - timedelta(days=days)
        items = self.db.query(
            Food.name, 
            func.sum(OrderItem.quantity).label("quantity"), 
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("revenue")
        ).join(OrderItem, Food.id == OrderItem.food_id)\
         .join(Order)\
         .filter(Order.created_at >= start, Order.status.in_(self.valid_statuses))\
         .group_by(Food.name)\
         .order_by(text("quantity DESC"))\
         .limit(limit).all()

        return [{"food_name": i.name, "quantity": int(i.quantity), "revenue": float(i.revenue)} for i in items]

    def get_retention_data(self) -> Dict[str, Any]:
        """Placeholder to keep the API alive while you grow your user base."""
        return {
            "rate_14d": 0,
            "rate_30d": 0,
            "returning_users_30d": 0,
            "eligible_users_30d": 0
        }

    def get_peak_hours(self, days: int = 7) -> List[Dict[str, Any]]:
        start_limit = datetime.now(UTC) - timedelta(days=days)
        peak_query = self.db.query(
            func.to_char(func.timezone(self.tz, Order.created_at), 'HH24').label("hour"),
            case(
                (func.extract('minute', func.timezone(self.tz, Order.created_at)) < 30, '00'),
                else_='30'
            ).label("minute_slot"),
            func.count(Order.id).label("order_count")
        ).filter(Order.created_at >= start_limit)\
         .group_by("hour", "minute_slot")\
         .order_by(text("order_count DESC")).all()

        return [{"time_slot": f"{r.hour}:{r.minute_slot}", "order_count": r.order_count} for r in peak_query]

    def get_inventory_alerts(self, threshold_hours: int = 24) -> List[Dict[str, Any]]:
        """Calculates item velocity (burn rate) using a single optimized join."""
        limit = datetime.now(UTC) - timedelta(days=7)
        
        # Calculate units sold per hour over the last 7 days
        velocity_sub = self.db.query(
            OrderItem.food_id,
            (func.sum(OrderItem.quantity) / 168.0).label("units_per_hour")
        ).join(Order).filter(Order.created_at >= limit)\
         .group_by(OrderItem.food_id).subquery()

        foods = self.db.query(
            Food.name, 
            Food.stock_quantity, 
            velocity_sub.c.units_per_hour
        ).outerjoin(velocity_sub, Food.id == velocity_sub.c.food_id).all()

        alerts = []
        for name, stock, vel in foods:
            if stock is None: continue
            
            # If no sales, assume low velocity to avoid division by zero
            hourly_vel = float(vel or 0.01) 
            hours_left = stock / hourly_vel
            
            if hours_left < threshold_hours or stock < 10:
                alerts.append({
                    "food_name": name,
                    "current_stock": stock,
                    "hours_remaining": round(hours_left, 1) if hours_left < 100 else "Stable",
                    "priority": "HIGH" if hours_left < 6 else "MEDIUM"
                })
        
        return sorted(alerts, key=lambda x: (x["priority"] == "MEDIUM", x["hours_remaining"]))
