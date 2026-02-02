from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model."""

    def get_by_phone(self, db: Session, *, phone_number: str) -> User | None:
        """Get user by phone number."""
        return db.query(User).filter(User.phone_number == phone_number).first()


crud_user = CRUDUser(User)
