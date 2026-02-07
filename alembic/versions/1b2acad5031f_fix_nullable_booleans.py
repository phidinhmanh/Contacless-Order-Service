"""fix_nullable_booleans

Revision ID: 1b2acad5031f
Revises: 01c7b4519155
Create Date: 2026-02-07 07:52:47.842159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b2acad5031f'
down_revision: Union[str, Sequence[str], None] = '01c7b4519155'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Fix CATEGORIES table ---
    # 1. Update existing nulls
    op.execute("UPDATE categories SET is_active = true WHERE is_active IS NULL")
    # 2. Set server default and make non-nullable
    op.alter_column('categories', 'is_active',
               existing_type=sa.Boolean(),
               nullable=False,
               server_default=sa.text('true'))

    # --- Fix FOODS table ---
    op.execute("UPDATE foods SET is_out_of_stock = false WHERE is_out_of_stock IS NULL")
    op.alter_column('foods', 'is_out_of_stock',
               existing_type=sa.Boolean(),
               nullable=False,
               server_default=sa.text('false'))

    # --- Fix ORDERS table ---
    op.execute("UPDATE orders SET status = 'pending' WHERE status IS NULL")
    op.alter_column('orders', 'status',
               existing_type=sa.String(length=20),
               nullable=False,
               server_default='pending')


def downgrade() -> None:
    # To revert, we simply allow nulls again
    op.alter_column('categories', 'is_active', nullable=True)
    op.alter_column('foods', 'is_out_of_stock', nullable=True)
    op.alter_column('orders', 'status', nullable=True)
