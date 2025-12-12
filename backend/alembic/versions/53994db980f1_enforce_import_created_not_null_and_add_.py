"""enforce_import_created_not_null_and_add_cleanup

This migration enforces that imports.created is NOT NULL to ensure all import
records have a creation timestamp for cleanup operations.

Revision ID: 53994db980f1
Revises: fc3df1d9ee4e
Create Date: 2025-12-12 11:44:35.339616

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "53994db980f1"
down_revision = "fc3df1d9ee4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Enforce NOT NULL constraint on imports.created column.

    This ensures all import records have a creation timestamp, which is
    essential for the cleanup task that removes old import_files records.
    """
    # First, update any existing NULL values to current timestamp
    # (there shouldn't be any due to default=func.now(), but be safe)
    op.execute(sa.text("UPDATE imports SET created = NOW() WHERE created IS NULL"))

    # Now alter the column to be NOT NULL and set an explicit server default
    # Use sa.text("NOW()") instead of func.now() so Alembic can serialize it
    # consistently across dialects and in autogeneration.
    op.alter_column(
        "imports",
        "created",
        existing_type=sa.DateTime(),
        nullable=False,
        existing_nullable=True,
        server_default=sa.text("NOW()"),
    )


def downgrade() -> None:
    """Revert NOT NULL constraint and server default on imports.created column."""
    op.alter_column(
        "imports",
        "created",
        existing_type=sa.DateTime(),
        nullable=True,
        existing_nullable=False,
        server_default=None,
    )
