from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
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
        category: str | None = None,
        include_unavailable: bool = False
    ) -> list[Food]:
        """Get food items with optional category and availability filtering."""
        query = db.query(Food)
        if category:
            query = query.filter(Food.category == category)
        if not include_unavailable:
            query = query.filter(Food.is_available == True)
        return query.offset(skip).limit(limit).all()

    def get_categories(self, db: Session) -> list[str]:
        """Get list of unique food categories."""
        categories = db.query(Food.category).distinct().all()
        return [c[0] for c in categories if c[0]]


crud_food = CRUDFood(Food)
