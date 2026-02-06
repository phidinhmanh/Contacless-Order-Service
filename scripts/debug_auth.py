from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import verify_password, hash_password

def debug_auth():
    db = SessionLocal()
    try:
        phone = "0386868686"
        user = db.query(User).filter(User.phone_number == phone).first()
        if not user:
            print("User not found in DB!")
            return
        
        password = "AdminPassword123!"
        is_stored_valid = verify_password(password, user.hashed_password)
        print(f"DEBUG_USER_ACTIVE: {user.is_active}")
        print(f"DEBUG_VERIFY_STORED: {is_stored_valid}")
        
        fresh_hash = hash_password(password)
        is_fresh_valid = verify_password(password, fresh_hash)
        print(f"DEBUG_VERIFY_FRESH: {is_fresh_valid}")
        print(f"DEBUG_HASH_MATCH: {user.hashed_password == fresh_hash}")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_auth()
