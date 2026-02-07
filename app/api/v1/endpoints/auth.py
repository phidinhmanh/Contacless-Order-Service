from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.security import (
    ALGORITHM,
    GUEST_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)
from app.crud import crud_user
from app.models.user import User
from app.schemas.auth import RefreshTokenRequest, Token , GuestLoginRequest
from app.schemas.user import UserCreate, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    user_in: UserCreate,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Register a new user account.
    
    - Phone number must be valid Vietnamese format
    - Password must be at least 8 characters with uppercase, lowercase, and digit
    """
    # Check if phone number already exists
    existing = crud_user.get_by_phone(db, phone_number=user_in.phone_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already exists",
        )

    # Create user with hashed password
    user = User(
        phone_number=user_in.phone_number,
        full_name=user_in.full_name,
        gender=user_in.gender,
        hashed_password=hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    """
    OAuth2 compatible login endpoint.
    
    - Use phone number as username
    - Returns access and refresh tokens
    - Access token expires in 24 hours
    """
    # Strip whitespace to handle potential copy-paste issues (TC-AUTH-01)
    username = form_data.username.strip()
    
    # Find user by phone number
    user = crud_user.get_by_phone(db, phone_number=username)
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or password not set",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.hashed_password):
        print(hash_password(form_data.password), flush=True)
        print(user.hashed_password, flush=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # Update last login
    user.last_login = datetime.now(UTC)
    db.commit()

    # Generate tokens
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=Token)
def refresh_token(
    token_request: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Refresh access token using a valid refresh token.
    
    - Implements refresh token rotation (new refresh token on each use)
    - Returns new access and refresh tokens
    """
    payload = verify_token(token_request.refresh_token, token_type="refresh")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Generate new token pair (rotation)
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/guest", response_model=Token)
def login_as_guest(
    request_data : GuestLoginRequest,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
    guest_user_id: str | None = Cookie(None), # Placeholder for cookie injection logic
):
    """
    Login as an anonymous guest.
    
    - Creates or REUSES a temporary user record (TC-AUTH-07)
    - Returns a 30-day access token
    - Sets/Updates a guest_id cookie for re-entry recognition
    - If table_id is provided, binds session to that table (TC-ORDER-07)
    """
    # Note: In a real app, use: @request.cookies.get("guest_user_id")
    # For this implementation, we simulate the lookup logic
    user = None
    if guest_user_id:
        user = db.query(User).filter(User.id == int(guest_user_id), User.phone_number == None).first()

    if not user:
        # Create a new anonymous user
        user = User(
            full_name="Guest User",
            role="customer",
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Refresh/Set 30-day persistent cookie for LTV tracking (TC-AUTH-07)
    response.set_cookie(
        key="guest_user_id",
        value=str(user.id),
        max_age=GUEST_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax"
    )

    # Include table_id in token payload if provided (TC-ORDER-07)
    extra_claims = {}
    if request_data.table_id:
        extra_claims["table_id"] = request_data.table_id

    access_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(days=GUEST_TOKEN_EXPIRE_DAYS),
        extra_claims=extra_claims
    )

    return Token(
        access_token=access_token,
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout")
def logout(response: Response):
    """
    Logout the current user.
    - Clears the persistent guest_user_id cookie.
    """
    response.delete_cookie("guest_user_id")
    return {"detail": "Successfully logged out"}


@router.post("/guest/demographics")
def update_guest_demographics(
    db: Annotated[Session, Depends(get_db)],
    guest_id: int,
    gender: str | None = None,
    age_group: str | None = None,
):
    """
    Update demographics for a guest user (no auth required).
    
    - guest_id: The guest user ID from cookie/localStorage
    - gender: male, female, other
    - age_group: under_18, 18_24, 25_34, 35_44, 45_54, 55_plus
    """
    # Find the guest user (users without phone number)
    user = db.query(User).filter(
        User.id == guest_id,
        User.phone_number.is_(None)  # Ensure it's a guest
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest user not found"
        )
    
    # Update demographics
    if gender:
        user.gender = gender
    if age_group:
        user.age_group = age_group
    
    db.commit()
    db.refresh(user)
    
    return {
        "detail": "Demographics updated successfully",
        "user_id": user.id,
        "gender": user.gender,
        "age_group": user.age_group,
    }

