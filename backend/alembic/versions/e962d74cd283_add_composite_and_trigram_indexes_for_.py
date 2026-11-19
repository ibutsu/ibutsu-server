"""add composite and trigram indexes for slow queries

Revision ID: e962d74cd283
Revises: c4d5e6f7a8b9
Create Date: 2026-10-19 19:34:42.734685

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e962d74cd283'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
