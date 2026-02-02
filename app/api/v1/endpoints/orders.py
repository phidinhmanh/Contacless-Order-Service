from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_current_table_id, get_current_user, get_db
from app.api.v1.endpoints.kitchen import broadcast_new_order, broadcast_order_update
from app.crud import crud_order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse, OrderUpdate
from app.services.order_service import OrderService

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
def get_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all orders with pagination."""
    return crud_order.get_multi(db, skip=skip, limit=limit)


@router.get("/status/{status}", response_model=list[OrderResponse])
def get_orders_by_status(status: str, db: Session = Depends(get_db)):
    """Get all orders by status."""
    return crud_order.get_by_status(db, status=status)


@router.get("/table/{table_id}", response_model=list[OrderResponse])
def get_orders_by_table(table_id: int, db: Session = Depends(get_db)):
    """Get all orders for a specific table."""
    return crud_order.get_by_table(db, table_id=table_id)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get a specific order by ID."""
    order = crud_order.get(db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/", response_model=OrderResponse, status_code=201)
def create_order(
    order_in: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    table_id_from_token: int | None = Depends(get_current_table_id),
):
    """
    Create a new order with items.
    
    TC-ORDER-07: Enforces Table Integrity. 
    If token is bound to a table (from QR scan), body.table_id must match.
    """
    if table_id_from_token and order_in.table_id != table_id_from_token:
        raise HTTPException(
            status_code=403,
            detail=f"Table mismatch. You are session-bound to Table {table_id_from_token}."
        )

    order_service = OrderService(db)
    order = order_service.create_order(order_in)
    background_tasks.add_task(broadcast_new_order, order)
    return order


@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_in: OrderUpdate,
    db: Session = Depends(get_db),
):
    """Update an order (e.g., change status)."""
    order = crud_order.get(db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return crud_order.update(db, db_obj=order, obj_in=order_in)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel an order within 2 minutes of creation.
    Requires the user who created the order.
    """
    order_service = OrderService(db)
    order = order_service.cancel_order(order_id=order_id, user_id=current_user.id)
    background_tasks.add_task(broadcast_order_update, order, "order_cancelled")
    return order


@router.delete("/{order_id}", response_model=OrderResponse)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Delete an order."""
    order = crud_order.delete(db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
