"""
GDPR compliance endpoint for customer data export.
Required for EU data protection regulations.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.order import Order
from app.models.user import User

router = APIRouter()


@router.get("/{user_id}/export")
def export_user_data(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Export all user data for GDPR compliance.
    
    Users can only export their own data unless they are admin.
    Returns all personal data, orders, and related information.
    """
    # Authorization check
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to export this user's data"
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's orders with items
    orders = db.query(Order).filter(Order.user_id == user_id).all()

    # Build export data (excluding hashed_password)
    export_data = {
        "user": {
            "id": user.id,
            "phone_number": user.phone_number,
            "full_name": user.full_name,
            "gender": user.gender,
            "role": user.role,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        },
        "orders": [
            {
                "id": order.id,
                "table_id": order.table_id,
                "total_price": order.total_price,
                "status": order.status,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "items": [
                    {
                        "food_id": item.food_id,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price if hasattr(item, 'unit_price') else None,
                    }
                    for item in order.items
                ] if order.items else [],
            }
            for order in orders
        ],
        "export_date": datetime.now(UTC).isoformat(),
        "data_retention_info": "Your data will be retained for 7 years for legal compliance.",
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=user_{user_id}_data_export.json"
        }
    )

