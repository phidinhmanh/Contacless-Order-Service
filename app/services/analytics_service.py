import pytz
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List
from sqlalchemy import func, text, case
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.order import Order, OrderItem, OrderStatus
from app.models.table_session import TableSession
from app.models.user import User


def convert_to_utc(dt: datetime | None) -> datetime | None:
    """Convert a datetime to UTC. Handles timezone-aware and naive datetimes."""
    if dt is None:
        return None
    
    vn_tz = pytz.timezone("Asia/Ho_Chi_Minh")
    
    if dt.tzinfo is None:
        # Naive datetime - assume Vietnam timezone
        dt = vn_tz.localize(dt)
    
    return dt.astimezone(UTC)


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
        # Convert input datetimes to UTC
        start_date = convert_to_utc(start_date)
        end_date = convert_to_utc(end_date)
        
        if not start_date:
            now_vn = datetime.now(UTC).astimezone(pytz.timezone(self.tz))
            start_date = now_vn.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)
        end_date = end_date or datetime.now(UTC)
        
        print(f"[DEBUG] Querying revenue from {start_date} to {end_date}")
        print(f"[DEBUG] Valid statuses: {self.valid_statuses}")
        
        res = self.db.query(
            func.sum(Order.total_price).label("revenue"),
            func.count(Order.id).label("count")
        ).filter(
            Order.created_at.between(start_date, end_date),
            Order.status.in_(self.valid_statuses)
        ).first()
        
        print(f"[DEBUG] Query result: revenue={res.revenue}, count={res.count}")
        
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
        """Fixed raw SQL using double quotes for aliases and .mappings() to prevent NoSuchColumnError.
        Includes demographic breakdowns from the User model.
        """
        sql = text("""
            SELECT 
                COUNT(s.id) as total_sessions,
                COUNT(DISTINCT s.lead_user_id) FILTER (WHERE s.lead_user_id IS NOT NULL) as unique_auth_users,
                COUNT(s.id) FILTER (WHERE s.lead_user_id IS NULL) as anon_sessions,
                (SELECT COUNT(*) FROM (
                    SELECT lead_user_id FROM table_sessions 
                    WHERE lead_user_id IS NOT NULL 
                    GROUP BY lead_user_id HAVING COUNT(id) > 1
                ) as sub_retention) as returning_count,
                -- Demographics
                COUNT(u.id) FILTER (WHERE u.gender = 'male') as male_count,
                COUNT(u.id) FILTER (WHERE u.gender = 'female') as female_count,
                COUNT(u.id) FILTER (WHERE u.gender = 'other') as other_gender_count,
                COUNT(u.id) FILTER (WHERE u.age_group = 'under_18') as age_under_18,
                COUNT(u.id) FILTER (WHERE u.age_group = '18_24') as age_18_24,
                COUNT(u.id) FILTER (WHERE u.age_group = '25_34') as age_25_34,
                COUNT(u.id) FILTER (WHERE u.age_group = '35_44') as age_35_44,
                COUNT(u.id) FILTER (WHERE u.age_group = '45+') as age_45_plus
            FROM table_sessions s
            LEFT JOIN users u ON s.lead_user_id = u.id
        """)
        
        # .mappings() is the key to fixing your "NoSuchColumnError"
        res = self.db.execute(sql).mappings().first()

        print(f"[DEBUG] Query result: {res}")
        total_customers = (res['unique_auth_users'] or 0) + (res['anon_sessions'] or 0)
        returning = res['returning_count'] or 0
        new_customers = total_customers - returning

        return {
            "total_customers": total_customers,
            "new_customers": new_customers,
            "returning_customers": returning,
            "retention_rate": round((returning / total_customers * 100), 2) if total_customers > 0 else 0,
            "demographics": {
                "gender": {
                    "male": res['male_count'] or 0,
                    "female": res['female_count'] or 0,
                    "other": res['other_gender_count'] or 0
                },
                "age_groups": {
                    "under_18": res['age_under_18'] or 0,
                    "18_24": res['age_18_24'] or 0,
                    "25_34": res['age_25_34'] or 0,
                    "35_44": res['age_35_44'] or 0,
                    "45+": res['age_45_plus'] or 0
                }
            }
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
        """Calculate 14-day and 30-day retention metrics."""
        now = datetime.now(UTC)

        def _retention(window_days: int) -> tuple[int, int, float]:
            window_start = now - timedelta(days=window_days)

            recent_users = {
                row[0]
                for row in self.db.query(Order.user_id)
                .filter(Order.user_id.isnot(None), Order.created_at >= window_start)
                .distinct()
                .all()
            }
            prior_users = {
                row[0]
                for row in self.db.query(Order.user_id)
                .filter(Order.user_id.isnot(None), Order.created_at < window_start)
                .distinct()
                .all()
            }

            returning_users = len(recent_users & prior_users)
            eligible_users = len(prior_users)
            rate = round((returning_users / eligible_users * 100), 2) if eligible_users else 0
            return returning_users, eligible_users, rate

        returning_14d, eligible_14d, rate_14d = _retention(14)
        returning_30d, eligible_30d, rate_30d = _retention(30)

        return {
            "rate_14d": rate_14d,
            "returning_users_14d": returning_14d,
            "eligible_users_14d": eligible_14d,
            "rate_30d": rate_30d,
            "returning_users_30d": returning_30d,
            "eligible_users_30d": eligible_30d,
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
                    "velocity_per_hour": round(hourly_vel, 3),
                    "estimated_hours_remaining": round(hours_left, 1) if hours_left < 100 else "Stable",
                    "priority": "HIGH" if hours_left < 6 else "MEDIUM"
                })
        
        return sorted(alerts, key=lambda x: (x["priority"] == "MEDIUM", x["estimated_hours_remaining"]))

    def get_daily_revenue(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get daily revenue for charting."""
        start = datetime.now(UTC) - timedelta(days=days)
        result = self.db.query(
            func.date(func.timezone(self.tz, Order.created_at)).label("date"),
            func.sum(Order.total_price).label("revenue")
        ).filter(Order.created_at >= start, Order.status.in_(self.valid_statuses))\
         .group_by("date")\
         .order_by("date").all()

        return [{"date": str(r.date), "revenue": float(r.revenue)} for r in result]

    def get_table_revenue(self, days: int = 30) -> List[Dict[str, Any]]:
        """Analyze revenue by table."""
        start = datetime.now(UTC) - timedelta(days=days)
        result = self.db.query(
            Order.table_id,
            func.sum(Order.total_price).label("total_revenue"),
            func.count(Order.id).label("order_count")
        ).filter(Order.created_at >= start, Order.status.in_(self.valid_statuses))\
         .group_by(Order.table_id)\
         .order_by(text("total_revenue DESC")).all()

        return [{
            "table_id": r.table_id,
            "total_revenue": float(r.total_revenue),
            "order_count": r.order_count,
            "avg_order_value": float(r.total_revenue / r.order_count) if r.order_count > 0 else 0
        } for r in result]
