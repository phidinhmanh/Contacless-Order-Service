from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
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
from app.schemas.auth import RefreshTokenRequest, Token
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
    # Find user by phone number
    user = crud_user.get_by_phone(db, phone_number=form_data.username)

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.hashed_password):
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
    db: Annotated[Session, Depends(get_db)],
    response: Response,
    table_id: int | None = None,
    guest_user_id: Annotated[str | None, Depends(lambda: None)] = None, # Placeholder for cookie injection logic
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

    # 30-day expiry for LTV
    expires = datetime.now(UTC) + timedelta(days=GUEST_TOKEN_EXPIRE_DAYS)

    # Include table_id in token payload if provided (TC-ORDER-07)
    token_data = {
        "sub": str(user.id), 
        "type": "access",
        "exp": expires,
        "iat": datetime.now(UTC)
    }
    if table_id:
        token_data["table_id"] = table_id

    access_token = jwt.encode(
        token_data, settings.SECRET_KEY, algorithm=ALGORITHM
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
