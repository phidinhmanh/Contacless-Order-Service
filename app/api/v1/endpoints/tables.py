from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.crud import crud_table
from app.schemas.table import TableCreate, TableResponse, TableUpdate

router = APIRouter()


@router.get("/", response_model=list[TableResponse])
def get_tables(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all tables with pagination."""
    return crud_table.get_multi(db, skip=skip, limit=limit)




@router.get("/{table_id}/session")
def get_table_session(table_id: int, db: Session = Depends(get_db)):
    """
    Check current table status.
    Returns 'occupied' if there are active (pending/confirmed/preparing/ready) orders, 
    otherwise 'free'.
    """
    from app.models.order import Order
    active_statuses = ["pending", "confirmed", "preparing", "ready"]
    active_orders = db.query(Order).filter(
        Order.table_id == table_id,
        Order.status.in_(active_statuses)
    ).first()

    if active_orders:
        return {"status": "occupied", "table_id": table_id}
    return {"status": "free", "table_id": table_id}


@router.post("/", response_model=TableResponse, status_code=201)
def create_table(table_in: TableCreate, db: Session = Depends(get_db)):
    """Create a new table."""
    existing = crud_table.get_by_number(db, table_number=table_in.table_number)
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
    return crud_table.create(db, obj_in=table_in)


@router.put("/{table_id}", response_model=TableResponse)
def update_table(
    table_id: int,
    table_in: TableUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing table."""
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return crud_table.update(db, db_obj=table, obj_in=table_in)


@router.delete("/{table_id}", response_model=TableResponse)
def delete_table(table_id: int, db: Session = Depends(get_db)):
    """Delete a table."""
    table = crud_table.delete(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table
