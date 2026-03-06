"""
Security utilities for authentication and authorization.
Implements bcrypt password hashing and JWT token management.
"""

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt  # type: ignore[import-untyped]
from passlib.context import CryptContext  # type: ignore[import-untyped]

from app.core.config import settings

# Password hashing context with bcrypt (12 rounds minimum)
# Workaround for bcrypt 4.1.0+ compatibility issues with passlib
if not hasattr(bcrypt, '__about__'):
    try:
        bcrypt.__about__ = type('about', (object,), {'__version__': bcrypt.__version__})  # type: ignore[attr-defined, assignment]
    except AttributeError:
        pass

# Bcrypt rounds configuration (lower for testing)
BCRYPT_ROUNDS = int(os.getenv('BCRYPT_ROUNDS', '12'))

# Password hashing context
pwd_context = CryptContext(
    schemes=['bcrypt'], deprecated='auto', bcrypt__rounds=BCRYPT_ROUNDS
)

# JWT settings
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_HOURS = 24
GUEST_TOKEN_EXPIRE_DAYS = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with 12 rounds."""
    # Bcrypt has a 72 byte limit. Truncate to 72 bytes and decode safely.
    truncated_pass = password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.hash(truncated_pass)


def get_password_hash(password: str) -> str:
    return hash_password(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    truncated_pass = plain_password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.verify(truncated_pass, hashed_password)


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        subject: The token subject (usually user ID)
        expires_delta: Optional custom expiration time
        extra_claims: Optional extra claims to include in the payload

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode = {
        'sub': str(subject),
        'exp': expire,
        'type': 'access',
        'iat': datetime.now(UTC),
    }

    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str | Any) -> str:
    """
    Create a JWT refresh token with longer expiration.

    Args:
        subject: The token subject (usually user ID)

    Returns:
        Encoded JWT refresh token string
    """
    expire = datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        'jti': str(uuid.uuid4()),
        'sub': str(subject),
        'exp': expire,
        'type': 'refresh',
        'iat': datetime.now(UTC),
    }

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    """
    Decode and verify a JWT token.

    Args:
        token: The JWT token string

    Returns:
        Decoded payload dict or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_token(token: str, token_type: str = 'access') -> dict | None:
    """
    Verify a JWT token and check its type.

    Args:
        token: The JWT token string
        token_type: Expected token type ("access" or "refresh")

    Returns:
        Decoded payload if valid and correct type, None otherwise
    """
    payload = decode_token(token)
    if payload is None:
        return None

    if payload.get('type') != token_type:
        return None

    return payload
