from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.category import Category
from app.models.food import Food
from app.schemas.food import FoodCreate, FoodUpdate


class CRUDFood(CRUDBase[Food, FoodCreate, FoodUpdate]):
    """CRUD operations for Food model."""

    def get_multi_with_filters(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        category_id: int | None = None,
        include_unavailable: bool = False,
        include_deleted: bool = False,
    ) -> list[Food]:
        """Get food items with optional category and availability filtering."""
        query = db.query(Food)

        # Exclude soft-deleted items by default
        if not include_deleted:
            query = query.filter(Food.deleted_at.is_(None))

        if category_id:
            query = query.filter(Food.category_id == category_id)
        if not include_unavailable:
            query = query.filter(Food.is_available.is_(True))
        return query.offset(skip).limit(limit).all()

    def get_categories(self, db: Session) -> list[Category]:
        """Get list of active categories with foods."""
        return (
            db.query(Category)
            .filter(Category.is_active)
            .order_by(Category.display_order, Category.name)
            .all()
        )

    def soft_delete(self, db: Session, *, id: int) -> Food | None:
        """Soft delete a food item instead of hard delete."""
        from datetime import UTC, datetime

        food = self.get(db, id=id)
        if food:
            food.deleted_at = datetime.now(UTC)
            db.commit()
            db.refresh(food)
        return food


crud_food = CRUDFood(Food)
