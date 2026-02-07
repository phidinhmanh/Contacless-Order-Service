from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


class CRUDCategory(CRUDBase[Category, CategoryCreate, CategoryUpdate]):
    """CRUD operations for Category model."""

    def get_by_name(self, db: Session, *, name: str) -> Category | None:
        """Get category by name."""
        return db.query(Category).filter(Category.name == name).first()

    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[Category]:
        """Get only active categories, ordered by display_order."""
        return (
            db.query(Category)
            .filter(Category.is_active == True)
            .order_by(Category.display_order, Category.name)
            .offset(skip)
            .limit(limit)
            .all()
        )


crud_category = CRUDCategory(Category)
