from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.crud import crud_food
from app.schemas.category import CategoryResponse
from app.schemas.food import FoodResponse

router = APIRouter()


@router.get('', response_model=list[FoodResponse])
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
        include_unavailable=include_unavailable,
    )


@router.get('/categories', response_model=list[CategoryResponse])
def get_categories(db: Annotated[Session, Depends(get_db)]):
    """Get all active food categories for UI tabs."""
    return crud_food.get_categories(db)
