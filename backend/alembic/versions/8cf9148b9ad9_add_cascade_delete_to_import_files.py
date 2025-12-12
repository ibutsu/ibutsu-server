"""add_cascade_delete_to_import_files

This migration adds CASCADE delete to the import_files foreign key constraint.
When an import record is deleted, its associated import_file records will be
automatically deleted as well.

Revision ID: 8cf9148b9ad9
Revises: 53994db980f1
Create Date: 2025-12-12 11:48:53.138199

"""

from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "8cf9148b9ad9"
down_revision = "53994db980f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add CASCADE delete to import_files.import_id foreign key.

    This ensures that when an import record is deleted, all associated
    import_file records are automatically deleted as well.
    """
    # Dynamically look up the existing FK constraint name to support different naming conventions
    bind = op.get_bind()
    inspector = inspect(bind)
    fks = inspector.get_foreign_keys("import_files")

    # Find the FK constraint for import_id -> imports.id
    fk_name = None
    for fk in fks:
        if fk["constrained_columns"] == ["import_id"] and fk["referred_table"] == "imports":
            fk_name = fk["name"]
            break

    if not fk_name:
        # Fallback to the default PostgreSQL name if not found
        fk_name = "import_files_import_id_fkey"

    # Drop the existing foreign key constraint
    op.drop_constraint(fk_name, "import_files", type_="foreignkey")

    # Recreate it with ON DELETE CASCADE
    op.create_foreign_key(
        fk_name,
        "import_files",
        "imports",
        ["import_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Remove CASCADE delete from import_files.import_id foreign key."""
    # Dynamically look up the existing FK constraint name to support different naming conventions
    bind = op.get_bind()
    inspector = inspect(bind)
    fks = inspector.get_foreign_keys("import_files")

    # Find the FK constraint for import_id -> imports.id
    fk_name = None
    for fk in fks:
        if fk["constrained_columns"] == ["import_id"] and fk["referred_table"] == "imports":
            fk_name = fk["name"]
            break

    if not fk_name:
        # Fallback to the default PostgreSQL name if not found
        fk_name = "import_files_import_id_fkey"

    # Drop the foreign key with CASCADE
    op.drop_constraint(fk_name, "import_files", type_="foreignkey")

    # Recreate it without CASCADE
    op.create_foreign_key(fk_name, "import_files", "imports", ["import_id"], ["id"])
