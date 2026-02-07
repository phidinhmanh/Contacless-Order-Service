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

def reset_admin_password():
    db = SessionLocal()
    try:
        phone = "0386868686"
        existing = db.query(User).filter(User.phone_number == phone).first()
        if not existing:
            print(f"Admin with phone {phone} does not exist.")
            return
        import getpass
        new_password = getpass.getpass("Enter new password: ")

        existing.hashed_password = hash_password(new_password)
        db.commit()
        print(f"Admin password reset successfully! Phone: {phone}, Password: {new_password}")
    finally:
        db.close()

if __name__ == "__main__":
    choice = input("Enter 1 to create admin, 2 to reset admin password: ")
    if choice == "1":
        create_admin()
    elif choice == "2":
        reset_admin_password()
    else:
        print("Invalid choice.")
