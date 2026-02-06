import os
import qrcode
from sqlalchemy.orm import Session
import sys

# Add the project root to sys.path to allow imports from 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.table import Table
from app.core.config import settings

# Configuration
QR_CODE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "qr_codes")


def generate_qr_code(table_id: int, table_number: int, base_url: str) -> str:
    """
    Generate QR code for a table and save to disk.
    Returns the path to the saved QR code.
    """
    os.makedirs(QR_CODE_DIR, exist_ok=True)
    
    table_url = f"{base_url}/?table={table_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(table_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#1a1a2e", back_color="white")
    
    filename = f"table_{table_number}_qr.png"
    filepath = os.path.join(QR_CODE_DIR, filename)
    img.save(filepath)
    
    return f"/static/qr_codes/{filename}"

def main():
    db = SessionLocal()
    try:
        tables = db.query(Table).all()
        print(f"Found {len(tables)} tables to regenerate.")
        
        for table in tables:
            print(f"Regenerating QR for Table {table.table_number} (ID: {table.id})...")
            qr_path = generate_qr_code(table.id, table.table_number, settings.FRONTEND_URL)
            table.qr_code_path = qr_path
            print(f"  -> Saved to {qr_path}")
            
        db.commit()
        print("\nAll QR codes regenerated successfully!")
        print(f"New base URL: {settings.FRONTEND_URL}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
