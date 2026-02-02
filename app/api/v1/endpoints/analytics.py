"""
Analytics endpoints for business intelligence.
Provides revenue dashboards and export functionality.
"""

from datetime import UTC, datetime
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User, UserRole
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/revenue")
def get_revenue_summary(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    start_date: datetime | None = Query(None, description="Start date for report"),
    end_date: datetime | None = Query(None, description="End date for report"),
):
    """
    Get revenue summary for a date range.
    Defaults to last 24 hours. Requires ADMIN or MANAGER role.
    
    Updates every 5 minutes (via frontend polling or caching).
    """
    analytics = AnalyticsService(db)
    return analytics.get_revenue_summary(start_date, end_date)


@router.get("/peak-hours")
def get_peak_hours(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
):
    """
    Get peak hour analysis with 30-minute intervals.
    Requires ADMIN or MANAGER role.
    """
    analytics = AnalyticsService(db)
    return analytics.get_peak_hours(days=days)


@router.get("/customers")
def get_customer_segments(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """
    Get new vs returning customer analysis.
    Requires ADMIN or MANAGER role.
    """
    analytics = AnalyticsService(db)
    return analytics.get_customer_segments()


@router.get("/retention")
def get_retention_rate(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """
    Get 14-day and 30-day customer retention rates.
    Critical for analyzing the effectiveness of marketing and food quality.
    """
    analytics = AnalyticsService(db)
    return analytics.get_retention_data()


@router.get("/inventory-alerts")
def get_inventory_alerts(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)),
    hours: int = Query(24, ge=1, le=168, description="Threshold hours of stock remaining"),
):
    """
    Get predictive alerts for items that are running low based on current order speed.
    """
    analytics = AnalyticsService(db)
    return analytics.get_inventory_alerts(threshold_hours=hours)


@router.get("/daily-revenue")
def get_daily_revenue(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
):
    """Get daily revenue for charting. Requires ADMIN or MANAGER role."""
    analytics = AnalyticsService(db)
    return analytics.get_daily_revenue(days=days)


@router.get("/tables")
def get_table_revenue(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
):
    """
    Analyze revenue and popularity by table.
    Identify the most profitable locations in the restaurant.
    Requires ADMIN or MANAGER role.
    """
    analytics = AnalyticsService(db)
    return analytics.get_table_revenue(days=days)


@router.get("/export")
def export_to_excel(
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
):
    """
    Export analytics data to Excel file.
    For accountant use. Requires ADMIN or MANAGER role.
    """
    from openpyxl import Workbook

    analytics = AnalyticsService(db)

    # Create workbook
    wb = Workbook()

    # Revenue Summary sheet
    ws_revenue = wb.active
    ws_revenue.title = "Revenue Summary"
    revenue = analytics.get_revenue_summary(start_date, end_date)
    ws_revenue.append(["Metric", "Value"])
    ws_revenue.append(["Total Revenue", revenue["total_revenue"]])
    ws_revenue.append(["Order Count", revenue["order_count"]])
    ws_revenue.append(["Average Order Value", revenue["average_order_value"]])
    ws_revenue.append(["Period Start", revenue["period"]["start"]])
    ws_revenue.append(["Period End", revenue["period"]["end"]])

    # Daily Revenue sheet
    ws_daily = wb.create_sheet("Daily Revenue")
    ws_daily.append(["Date", "Revenue (VND)"])
    for row in analytics.get_daily_revenue(30):
        ws_daily.append([row["date"], row["revenue"]])

    # Peak Hours sheet
    ws_peak = wb.create_sheet("Peak Hours")
    ws_peak.append(["Time Slot", "Order Count"])
    for row in analytics.get_peak_hours(7):
        ws_peak.append([row["time_slot"], row["order_count"]])

    # Table Profitability sheet
    ws_tables = wb.create_sheet("Table Profitability")
    ws_tables.append(["Table ID", "Total Revenue (VND)", "Order Count", "Avg Order Value"])
    for row in analytics.get_table_revenue(30):
        ws_tables.append([row["table_id"], row["total_revenue"], row["order_count"], row["avg_order_value"]])

    # Customer Segments sheet
    ws_customers = wb.create_sheet("Customer Retention")
    retention = analytics.get_retention_data()
    ws_customers.append(["Window", "Retention Rate (%)", "Returning Users"])
    ws_customers.append(["14 Days", retention["rate_14d"], retention["returning_users_14d"]])
    ws_customers.append(["30 Days", retention["rate_30d"], retention["returning_users_30d"]])

    # Inventory Alerts sheet
    ws_inventory = wb.create_sheet("Inventory Alerts")
    ws_inventory.append(["Item", "Current Stock", "Velocity (unit/hr)", "Est. Hours Left", "Priority"])
    for alert in analytics.get_inventory_alerts(threshold_hours=72):
         ws_inventory.append([
             alert["food_name"],
             alert["current_stock"],
             alert["velocity_per_hour"],
             alert["estimated_hours_remaining"],
             alert["priority"]
         ])

    # Save to BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"analytics_report_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
