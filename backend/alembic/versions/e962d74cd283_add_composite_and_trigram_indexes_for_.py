"""add composite and trigram indexes for slow queries

Revision ID: e962d74cd283
Revises: c4d5e6f7a8b9
Create Date: 2026-10-19 19:34:42.734685

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e962d74cd283"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def _is_postgresql() -> bool:
    """Return True when this command is aimed at PostgreSQL."""
    bind = op.get_bind()
    if bind:
        return bind.dialect.name == "postgresql"
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgresql():
        return

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    # autocommit_block commits the migration transaction, runs these
    # statements one by one, and each one is saved immediately.
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_runs_project_id_start_time",
            "runs",
            ["project_id", sa.text("start_time DESC")],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.create_index(
            "ix_results_test_id_start_time",
            "results",
            ["test_id", sa.text("start_time DESC")],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        op.create_index(
            "ix_runs_source_trgm",
            "runs",
            ["source"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"source": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.create_index(
            "ix_runs_component_trgm",
            "runs",
            ["component"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"component": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.create_index(
            "ix_results_test_id_trgm",
            "results",
            ["test_id"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"test_id": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    if not _is_postgresql():
        return

    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_results_test_id_trgm",
            table_name="results",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_component_trgm",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_source_trgm",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.execute("DROP EXTENSION IF EXISTS pg_trgm")
        op.drop_index(
            "ix_results_test_id_start_time",
            table_name="results",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_project_id_start_time",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
