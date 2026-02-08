"""
Table management endpoints.
Managers can CRUD tables with automatic QR code generation.
Uses qr_token for domain-agnostic QR codes that survive domain changes.
"""
import io
import os
import secrets
from typing import Annotated
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.websocket import manager
from app.crud import crud_table
from app.models.user import User, UserRole
from app.models.table import Table
from app.schemas.table import TableCreate, TableResponse, TableUpdate
from app.schemas.table_session import TableSessionCreate, TableSessionResponse, TableSessionUpdate
from app.models.table_session import TableSession
from app.models.order import Order
from app.api.deps import get_current_user


router = APIRouter()

# Directory to store QR codes
QR_CODE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "static", "qr_codes")


def generate_qr_token() -> str:
    """Generate a secure, URL-safe token for QR codes."""
    return secrets.token_urlsafe(16)


def generate_qr_code(table_id: int, table_number: int, qr_token: str) -> str:
    """
    Generate QR code for a table using a TOKEN-BASED URL.
    
    This makes QR codes DOMAIN-AGNOSTIC:
    - QR encodes: /t/{qr_token}
    - Frontend resolves the actual menu URL at runtime
    - Domain can change without reprinting QR codes
    """
    # Ensure directory exists
    os.makedirs(QR_CODE_DIR, exist_ok=True)
    
    # Use relative path with token - DOMAIN AGNOSTIC!
    # The frontend will handle: /t/{token} -> redirect to /?table={id}
    table_url = f"/t/{qr_token}"
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(table_url)
    qr.make(fit=True)
    
    # Create image with restaurant branding colors
    img = qr.make_image(fill_color="#1a1a2e", back_color="white")
    
    # Save to file
    filename = f"table_{table_number}_qr.png"
    filepath = os.path.join(QR_CODE_DIR, filename)
    img.save(filepath)
    
    return f"/static/qr_codes/{filename}"


@router.get("/t/{qr_token}")
def resolve_qr_token(qr_token: str, db: Session = Depends(get_db)):
    """
    Resolve a QR token to the actual table.
    This is the SECRET SAUCE for domain-agnostic QR codes!
    
    Flow:
    1. Customer scans QR -> gets /t/abc123
    2. Browser requests https://current-domain.com/t/abc123
    3. This endpoint looks up the token -> redirects to /?table=5
    
    Benefits:
    - Domain can change, QR codes still work
    - Token can be rotated for security
    - Analytics tracking possible
    """
    table = db.query(Table).filter(
        Table.qr_token == qr_token,
        Table.deleted_at == None
    ).first()
    
    if not table:
        raise HTTPException(status_code=404, detail="Invalid or expired QR code")
    
    # Redirect to menu with table pre-selected
    return RedirectResponse(url=f"/?table={table.id}", status_code=302)


@router.get("", response_model=list[TableResponse])
def get_tables(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all tables with pagination."""
    return crud_table.get_multi(db, skip=skip, limit=limit)


@router.post("/{table_id}/session", response_model=TableSessionResponse)
def create_table_session(
    table_id: int,
    session_in: TableSessionCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """
    Create or join a session for the table.
    If an active session exists, return it (idempotent-ish).
    Otherwise create new.
    """
    # Check table existence
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Check for active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == "active"
    ).first()

    if active_session:
        # If no lead user currently, or if same user, return.
        # This keeps the session logic simple.
        return active_session
    
    # Create new session linked to user if available
    new_session = TableSession(
        table_id=table_id,
        lead_user_id=current_user.id if current_user else None,
        guest_count=session_in.guest_count,
        status="active"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("/{table_id}/session", response_model=dict)
def get_table_session_status(table_id: int, db: Session = Depends(get_db)):
    """
    Check current table status and active session info.
    Returns composite status.
    """
    active_statuses = ["pending", "confirmed", "preparing", "ready"]
    active_orders = db.query(Order).filter(
        Order.table_id == table_id,
        Order.status.in_(active_statuses)
    ).first()

    session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == "active"
    ).first()

    status = "occupied" if active_orders else "free"
    
    return {
        "status": status,
        "table_id": table_id,
        "session_id": session.id if session else None,
        "guest_count": session.guest_count if session else None,
        "lead_user_id": session.lead_user_id if session else None
    }


@router.post("", response_model=TableResponse, status_code=201)
def create_table(
    table_in: TableCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Create a new table with automatic QR code generation.
    Requires MANAGER or ADMIN role.
    """
    # Check if table number already exists
    existing = crud_table.get_by_number(db, table_number=table_in.table_number)
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
    
    # Create the table first
    table = crud_table.create(db, obj_in=table_in)
    
    # Generate QR token and code
    try:
        qr_token = generate_qr_token()
        table.qr_token = qr_token
        qr_path = generate_qr_code(table.id, table.table_number, qr_token)
        table.qr_code_path = qr_path
        db.commit()
        db.refresh(table)
    except Exception as e:
        # Log error but don't fail table creation
        print(f"Warning: Failed to generate QR code: {e}")
    
    background_tasks.add_task(manager.broadcast_to_all, {"type": "tables_update", "action": "create"})
    return table


@router.put("/{table_id}", response_model=TableResponse)
def update_table(
    table_id: int,
    table_in: TableUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Update an existing table.
    Requires MANAGER or ADMIN role.
    """
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # If table_number changed, regenerate QR
    old_number = table.table_number
    updated_table = crud_table.update(db, db_obj=table, obj_in=table_in)
    
    if table_in.table_number and table_in.table_number != old_number:
        try:
            # Delete old QR if exists
            if updated_table.qr_code_path:
                old_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                                       updated_table.qr_code_path.lstrip('/'))
                if os.path.exists(old_path):
                    os.remove(old_path)
            
            # Keep existing token but regenerate image with new table number
            if not updated_table.qr_token:
                updated_table.qr_token = generate_qr_token()
            qr_path = generate_qr_code(updated_table.id, updated_table.table_number, updated_table.qr_token)
            updated_table.qr_code_path = qr_path
            db.commit()
            db.refresh(updated_table)
        except Exception as e:
            print(f"Warning: Failed to regenerate QR code: {e}")
    
    background_tasks.add_task(manager.broadcast_to_all, {"type": "tables_update", "action": "update"})
    return updated_table


@router.delete("/{table_id}", response_model=TableResponse)
def delete_table(
    table_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Delete a table and its QR code.
    Requires MANAGER or ADMIN role.
    """
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Delete QR code file if exists
    if table.qr_code_path:
        try:
            filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                                   table.qr_code_path.lstrip('/'))
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Warning: Failed to delete QR code file: {e}")
    
    deleted_table = crud_table.delete(db, id=table_id)
    background_tasks.add_task(manager.broadcast_to_all, {"type": "tables_update", "action": "delete"})
    return deleted_table


@router.get("/{table_id}/qr")
def get_table_qr(
    table_id: int,
    db: Session = Depends(get_db),
):
    """
    Get or generate a QR code for a specific table.
    The QR encodes a TOKEN path like: /t/abc123
    Returns the QR code as a PNG image.
    """
    # Verify table exists
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Ensure table has a token
    if not table.qr_token:
        table.qr_token = generate_qr_token()
        db.commit()

    # If QR exists on disk, return it
    if table.qr_code_path:
        filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                               table.qr_code_path.lstrip('/'))
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                return StreamingResponse(
                    io.BytesIO(f.read()),
                    media_type="image/png",
                    headers={"Content-Disposition": f"inline; filename=table_{table.table_number}_qr.png"}
                )
    
    # Generate new QR if not exists
    qr_path = generate_qr_code(table.id, table.table_number, table.qr_token)
    table.qr_code_path = qr_path
    db.commit()
    
    # Return the generated QR
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                           qr_path.lstrip('/'))
    with open(filepath, "rb") as f:
        return StreamingResponse(
            io.BytesIO(f.read()),
            media_type="image/png",
            headers={"Content-Disposition": f"inline; filename=table_{table.table_number}_qr.png"}
        )


@router.post("/{table_id}/rotate-token", response_model=TableResponse)
def rotate_table_token(
    table_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Rotate the QR token for security (invalidates old QR codes).
    Use this if you suspect a QR code was leaked or for periodic security rotation.
    Requires MANAGER or ADMIN role.
    """
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Delete old QR if exists
    if table.qr_code_path:
        try:
            filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                                   table.qr_code_path.lstrip('/'))
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass
    
    # Generate new token and QR
    new_token = generate_qr_token()
    table.qr_token = new_token
    qr_path = generate_qr_code(table.id, table.table_number, new_token)
    table.qr_code_path = qr_path
    db.commit()
    db.refresh(table)
    
    return table


@router.post("/{table_id}/regenerate-qr", response_model=TableResponse)
def regenerate_table_qr(
    table_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Regenerate QR code image (keeps same token).
    Use this if QR image file was corrupted or deleted.
    Requires MANAGER or ADMIN role.
    """
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Delete old QR if exists
    if table.qr_code_path:
        try:
            filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
                                   table.qr_code_path.lstrip('/'))
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass
    
    # Ensure token exists
    if not table.qr_token:
        table.qr_token = generate_qr_token()
    
    # Generate new QR with existing token
    qr_path = generate_qr_code(table.id, table.table_number, table.qr_token)
    table.qr_code_path = qr_path
    db.commit()
    db.refresh(table)
    
    return table


@router.get("/{table_id}", response_model=TableResponse)
def get_table(table_id: int, db: Session = Depends(get_db)):
    """Get a specific table by ID."""
    table = crud_table.get(db, id=table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table
