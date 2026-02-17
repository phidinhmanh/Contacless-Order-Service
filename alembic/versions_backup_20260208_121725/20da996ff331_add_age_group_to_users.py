"""add age_group to users

Revision ID: 20da996ff331
Revises: 357c7c633381
Create Date: 2026-02-03 09:23:00.362372

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '20da996ff331'
down_revision: Union[str, Sequence[str], None] = '357c7c633381'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
