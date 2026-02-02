from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud import crud_food
from app.models.user import User, UserRole
from app.schemas.food import FoodCreate, FoodResponse, FoodStockUpdate, FoodUpdate

router = APIRouter()


@router.get("/", response_model=list[FoodResponse])
def get_menu(
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    category: str | None = None,
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
        category=category,
        include_unavailable=include_unavailable
    )


@router.get("/categories", response_model=list[str])
def get_categories(db: Annotated[Session, Depends(get_db)]):
    """Get all unique food categories for UI tabs."""
    return crud_food.get_categories(db)


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(food_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific food item by ID."""
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    return food


@router.post("/", response_model=FoodResponse, status_code=201)
def create_food(
    food_in: FoodCreate,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN))
):
    """Create a new food item. Requires ADMIN role."""
    # Note: CRUDBase handles standard fields; specific logic can be added here
    return crud_food.create(db, obj_in=food_in)


@router.patch("/{food_id}/stock", response_model=FoodResponse)
def update_food_stock(
    food_id: int,
    stock_in: FoodStockUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.STAFF))
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
        update_data["is_available"] = False

    return crud_food.update(db, db_obj=food, obj_in=update_data)


@router.put("/{food_id}", response_model=FoodResponse)
def update_food(
    food_id: int,
    food_in: FoodUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN))
):
    """Update an existing food item. Requires ADMIN role."""
    food = crud_food.get(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    return crud_food.update(db, db_obj=food, obj_in=food_in)


@router.delete("/{food_id}", response_model=FoodResponse)
def delete_food(
    food_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN))
):
    """Delete a food item. Requires ADMIN role."""
    food = crud_food.delete(db, id=food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    return food
