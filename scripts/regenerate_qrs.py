#!/usr/bin/env python3
"""
Script to migrate existing tables to use qr_token for domain-agnostic QR codes.
Run this after upgrading to regenerate all QR codes with tokens.

Usage: uv run python scripts/regenerate_qrs.py
"""

import os
import secrets
import sys

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import qrcode

from app.db.session import SessionLocal
from app.models.table import Table

QR_CODE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'qr_codes'
)


def generate_qr_token() -> str:
    """Generate a secure, URL-safe token for QR codes."""
    return secrets.token_urlsafe(16)


def generate_qr_code(table_id: int, table_number: int, qr_token: str) -> str:
    """
    Generate QR code for a table using a TOKEN-BASED URL.
    This makes QR codes DOMAIN-AGNOSTIC.
    """
    os.makedirs(QR_CODE_DIR, exist_ok=True)

    # Use relative path with token - DOMAIN AGNOSTIC!
    table_url = f'/t/{qr_token}'

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(table_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color='#1a1a2e', back_color='white')

    filename = f'table_{table_number}_qr.png'
    filepath = os.path.join(QR_CODE_DIR, filename)
    img.save(filepath)

    return f'/static/qr_codes/{filename}'


def main():
    """Regenerate all table QR codes with tokens."""
    print('🔄 Regenerating QR codes with domain-agnostic tokens...')

    db = SessionLocal()
    try:
        tables = db.query(Table).filter(Table.deleted_at.is_(None)).all()

        if not tables:
            print('ℹ️  No tables found in database.')
            return

        for table in tables:
            # Generate new token if missing
            if not table.qr_token:
                table.qr_token = generate_qr_token()
                print(f'  📝 Generated token for Table {table.table_number}')

            # Regenerate QR code
            qr_path = generate_qr_code(table.id, table.table_number, table.qr_token)
            table.qr_code_path = qr_path
            print(f'  ✅ Table {table.table_number}: {qr_path}')

        db.commit()
        print(f'\n🎉 Successfully regenerated {len(tables)} QR codes!')
        print('   QR codes now use /t/{token} format - domain agnostic!')

    finally:
        db.close()


if __name__ == '__main__':
    main()
