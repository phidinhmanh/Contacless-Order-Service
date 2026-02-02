from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.table import Table
from app.schemas.table import TableCreate, TableUpdate


class CRUDTable(CRUDBase[Table, TableCreate, TableUpdate]):
    """CRUD operations for Table model."""

    def get_by_number(self, db: Session, *, table_number: int) -> Table | None:
        """Get table by table number."""
        return db.query(Table).filter(Table.table_number == table_number).first()


crud_table = CRUDTable(Table)
