import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.websocket import manager
from app.crud import crud_food
from app.models.user import User, UserRole
from app.schemas.food import FoodCreate, FoodResponse, FoodStockUpdate, FoodUpdate
from app.schemas.category import CategoryResponse

router = APIRouter()

# Directory for storing food images
UPLOAD_DIR = Path("static/images/foods")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@router.get("", response_model=list[FoodResponse])
def get_menu(
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    category_id: int | None = None,
    include_unavailable: bool = False,
):
    """
    Get food items (the menu).
    Supports pagination, category filtering, and showing/hiding sold-out items.
    """
    return crud_food.get_multi_with_filters(
        db,
        skip=skip,
        limit=limit,
        category_id=category_id,
        include_unavailable=include_unavailable
    )


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(food_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific food item by ID."""
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    return food


@router.post("", response_model=FoodResponse, status_code=201)
def create_food(
    food_in: FoodCreate,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    """Create a new food item. Requires ADMIN role."""
    # Note: CRUDBase handles standard fields; specific logic can be added here
    food = crud_food.create(db, obj_in=food_in)
    background_tasks.add_task(manager.broadcast_to_all, {"type": "menu_update", "action": "create"})
    return food


@router.patch("/{food_id}/stock", response_model=FoodResponse)
def update_food_stock(
    food_id: int,
    stock_in: FoodStockUpdate,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF))
):
    """
    Quickly update stock quantity or availability.
    Useful for staff when items sell out mid-shift.
    Requires ADMIN or STAFF role.
    """
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    update_data = stock_in.model_dump(exclude_unset=True)
    if stock_in.stock_quantity == 0:
        update_data["is_out_of_stock"] = True
    obj_in = FoodUpdate(**update_data)

    updated_food = crud_food.update(db, db_obj=food, obj_in=obj_in)
    background_tasks.add_task(manager.broadcast_to_all, {"type": "menu_update", "action": "update_stock"})
    return updated_food


@router.put("/{food_id}", response_model=FoodResponse)
def update_food(
    food_id: int,
    food_in: FoodUpdate,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    """Update an existing food item. Requires ADMIN role."""
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    updated_food = crud_food.update(db, db_obj=food, obj_in=food_in)
    background_tasks.add_task(manager.broadcast_to_all, {"type": "menu_update", "action": "update"})
    return updated_food


@router.delete("/{food_id}", response_model=FoodResponse)
def delete_food(
    food_id: int,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    """Soft delete a food item. Requires ADMIN role."""
    food = crud_food.soft_delete(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    background_tasks.add_task(manager.broadcast_to_all, {"type": "menu_update", "action": "delete"})
    return food


@router.post("/{food_id}/image", response_model=FoodResponse)
def upload_food_image(
    food_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    """
    Upload an image for a food item.
    Accepts JPG, JPEG, PNG, GIF, or WebP files.
    Requires ADMIN or MANAGER role.
    """
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    
    # Validate file type
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Generate unique filename
    unique_filename = f"{food_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Delete old image if exists
    if food.image_url:
        old_path = Path(food.image_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink()
    
    # Save new image
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update food record with image URL
    image_url = f"/static/images/foods/{unique_filename}"
    update_data = FoodUpdate(image_url=image_url)
    updated_food = crud_food.update(db, db_obj=food, obj_in=update_data)
    background_tasks.add_task(manager.broadcast_to_all, {"type": "menu_update", "action": "update_image"})
    return updated_food
