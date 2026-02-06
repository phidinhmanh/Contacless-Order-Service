from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password

def create_admin():
    db = SessionLocal()
    try:
        phone = "0386868686"
        existing = db.query(User).filter(User.phone_number == phone).first()
        if existing:
            print(f"Admin with phone {phone} already exists.")
            return

        admin = User(
            phone_number=phone,
            full_name="System Admin",
            role=UserRole.ADMIN.value,
            hashed_password=hash_password("AdminPassword123!"),
            is_active=True,
            is_verified=True
        )
        db.add(admin)
        db.commit()
        print(f"Admin created successfully! Phone: {phone}, Password: AdminPassword123!")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
