from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_user, get_db, require_role
from app.crud import crud_user
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter()


@router.get('', response_model=list[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Get all users with pagination. Requires ADMIN or MANAGER role."""
    return crud_user.get_multi(db, skip=skip, limit=limit)


@router.patch('/me/lead-info', response_model=UserResponse)
def update_lead_info(
    full_name: str | None = None,
    phone_number: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update the current user's profile with Lead Guest info (Name/Phone).
    This transforms an anonymous guest into a more identified lead guest.
    """
    if full_name:
        current_user.full_name = full_name
    if phone_number:
        # Check uniqueness if not null
        existing = crud_user.get_by_phone(db, phone_number=phone_number)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail='Phone number already in use')
        current_user.phone_number = phone_number

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get('/me', response_model=UserResponse)
def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get current authenticated user info."""
    return current_user


@router.get('/{user_id}', response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific user by ID. Users can only view their own profile unless admin."""
    if current_user.id != user_id and current_user.role not in [
        UserRole.ADMIN.value,
        UserRole.MANAGER.value,
    ]:
        raise HTTPException(status_code=403, detail='Not authorized to view this user')

    user = crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    return user


@router.put('/{user_id}', response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing user. Users can only update their own profile unless admin."""
    if current_user.id != user_id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403, detail='Not authorized to update this user'
        )

    user = crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    return crud_user.update(db, db_obj=user, obj_in=user_in)


@router.delete('/{user_id}', response_model=UserResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    """Delete a user. Requires ADMIN role."""
    user = crud_user.delete(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user
