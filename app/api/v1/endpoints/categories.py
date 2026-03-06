from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.category import crud_category
from app.models.user import User, UserRole
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter()


@router.get('', response_model=list[CategoryResponse])
def get_categories(
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
):
    """Get all categories. By default, only active categories are returned."""
    if include_inactive:
        return crud_category.get_multi(db, skip=skip, limit=limit)
    return crud_category.get_active(db, skip=skip, limit=limit)


@router.get('/{category_id}', response_model=CategoryResponse)
def get_category(category_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific category by ID."""
    category = crud_category.get(db, id=category_id)
    if not category:
        raise HTTPException(status_code=404, detail='Category not found')
    return category


@router.post('', response_model=CategoryResponse, status_code=201)
def create_category(
    category_in: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Create a new category. Requires ADMIN or MANAGER role."""
    existing = crud_category.get_by_name(db, name=category_in.name)
    if existing:
        raise HTTPException(
            status_code=400, detail='Category with this name already exists'
        )
    return crud_category.create(db, obj_in=category_in)


@router.put('/{category_id}', response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Update a category. Requires ADMIN or MANAGER role."""
    category = crud_category.get(db, id=category_id)
    if not category:
        raise HTTPException(status_code=404, detail='Category not found')
    return crud_category.update(db, db_obj=category, obj_in=category_in)


@router.delete('/{category_id}', response_model=CategoryResponse)
def delete_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    """Delete a category. Requires ADMIN role."""
    category = crud_category.delete(db, id=category_id)
    if not category:
        raise HTTPException(status_code=404, detail='Category not found')
    return category
