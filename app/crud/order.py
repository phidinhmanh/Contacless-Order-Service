from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.order import Order, OrderItem
from app.schemas.order import OrderCreate, OrderItemCreate, OrderUpdate


class CRUDOrder(CRUDBase[Order, OrderCreate, OrderUpdate]):
    """CRUD operations for Order model."""

    def get(self, db: Session, id: int) -> Order | None:
        """Get a single order by ID with eager-loaded relationships."""
        return (
            db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.food))
            .filter(Order.id == id)
            .first()
        )

    def get_by_user(self, db: Session, *, user_id: int) -> list[Order]:
        """Get all orders for a user."""
        return db.query(Order).filter(Order.user_id == user_id).all()

    def get_by_table(self, db: Session, *, table_id: int) -> list[Order]:
        """Get all orders for a table."""
        return db.query(Order).filter(Order.table_id == table_id).all()

    def get_by_status(self, db: Session, *, status: str | list[str]) -> list[Order]:
        """Get all orders with a specific status or list of statuses."""
        if isinstance(status, list):
            return db.query(Order).filter(Order.status.in_(status)).all()
        return db.query(Order).filter(Order.status == status).all()

    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[Order]:
        """Get multiple orders with pagination and eager-loaded relationships."""
        return (
            db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.food))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def delete(self, db: Session, *, id: int) -> Order | None:
        """Delete an order by ID and return it with eager-loaded relationships."""
        obj = db.get(Order, id)
        if obj:
            # Eager load relationships before deletion for response serialization
            db.refresh(obj)
            db.delete(obj)
            db.commit()
        return obj


class CRUDOrderItem(CRUDBase[OrderItem, OrderItemCreate, OrderItemCreate]):
    """CRUD operations for OrderItem model."""

    def get_by_order(self, db: Session, *, order_id: int) -> list[OrderItem]:
        """Get all items for an order."""
        return db.query(OrderItem).filter(OrderItem.order_id == order_id).all()


crud_order = CRUDOrder(Order)
crud_order_item = CRUDOrderItem(OrderItem)
