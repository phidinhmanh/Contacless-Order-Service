"""
Shared API dependencies.
"""

from typing import Annotated, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token, verify_token
from app.db.session import SessionLocal
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/v1/auth/login')


def get_current_table_id(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> int | None:
    """
    Extract table_id from current session token.
    Ensures user is restricted to the table they scanned.
    """
    payload = decode_token(token)
    if not payload:
        return None
    return payload.get('table_id')


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency.
    Yields a database session and ensures it's closed after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """
    Validate JWT token and return current user.
    Raises 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )

    payload = verify_token(token, token_type='access')  # nosec
    if payload is None:
        raise credentials_exception

    user_id = payload.get('sub')
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='User account is deactivated',
        )

    return user


def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure current user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Inactive user',
        )
    return current_user


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory that requires specific roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """

    def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f'Insufficient permissions. Required: {[r.value for r in allowed_roles]}',
            )
        return current_user

    return role_checker


# Optional auth - returns None if no token provided
def get_optional_user(
    db: Annotated[Session, Depends(get_db)],
    token: str | None = Depends(
        OAuth2PasswordBearer(tokenUrl='/api/v1/auth/login', auto_error=False)
    ),
) -> User | None:
    """
    Get current user if authenticated, None otherwise.
    Useful for endpoints that work for both anonymous and authenticated users.
    """
    if token is None:
        return None

    payload = verify_token(token, token_type='access')
    if payload is None:
        return None

    user_id = payload.get('sub')
    if user_id is None:
        return None

    return db.query(User).filter(User.id == int(user_id)).first()
