import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole


def force_reset_admin():
    db = SessionLocal()
    try:
        phone = '0386868686'
        admin = db.query(User).filter(User.phone_number == phone).first()
        if not admin:
            print(f'Admin with phone {phone} not found. Creating...')
            admin = User(
                phone_number=phone,
                full_name='System Admin',
                role=UserRole.ADMIN.value,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)

        admin.hashed_password = hash_password('AdminPassword123!')
        db.commit()
        print(f"Admin password forced to 'AdminPassword123!' for phone {phone}")
    finally:
        db.close()


if __name__ == '__main__':
    force_reset_admin()
