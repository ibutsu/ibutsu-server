"""add_composite_indexes_artifacts_idempotency

Add composite indexes backing the archive-import idempotency lookups, which
fetch a single existing artifact by (result_id, filename) or (run_id, filename)
before deciding whether to update its content or insert a new row. The existing
single-column indexes on result_id/run_id/filename force the planner to scan and
filter; the composite indexes let the lookup resolve directly.

Revision ID: c4d5e6f7a8b9
Revises: d18de2b3253f
Create Date: 2026-08-27 00:00:00.000000

"""

import logging

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "d18de2b3253f"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.c4d5e6f7a8b9")


def _is_postgresql():
    """Check if the current database is PostgreSQL."""
    return op.get_bind().dialect.name == "postgresql"


def _index_exists(index_name, table_name) -> bool:
    """Check if an index already exists in PostgreSQL."""
    conn = op.get_bind()
    result = conn.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE indexname = :index_name
                AND tablename = :table_name
            )
        """
        ),
        {"index_name": index_name, "table_name": table_name},
    )
    return result.scalar()


def _create_index_if_not_exists(index_name, table_name, columns, **kwargs):
    """Idempotent index creation."""
    if not _is_postgresql():
        # Generic create index for non-PostgreSQL (e.g. SQLite)
        # Wrap in try/except since SQLite doesn't have a simple index existence check
        try:
            op.create_index(index_name, table_name, columns, **kwargs)
        except Exception as e:
            # Index may already exist - log and continue
            logger.warning(f"Could not create index {index_name}: {e}")
        return
    if _index_exists(index_name, table_name):
        return
    op.create_index(index_name, table_name, columns, **kwargs)


def _drop_index_if_exists(index_name, table_name):
    """Idempotent index drop."""
    if not _is_postgresql():
        # Wrap in try/except for SQLite since we can't check existence easily
        try:
            op.drop_index(index_name, table_name=table_name)
        except Exception as e:
            # Index may not exist - log and continue
            logger.warning(f"Could not drop index {index_name}: {e}")
        return
    if not _index_exists(index_name, table_name):
        return
    op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    """Create composite indexes on artifacts for import idempotency lookups."""
    logger.info("Creating composite index ix_artifacts_result_id_filename on artifacts")
    _create_index_if_not_exists(
        "ix_artifacts_result_id_filename",
        "artifacts",
        ["result_id", "filename"],
        unique=False,
    )
    logger.info("Creating composite index ix_artifacts_run_id_filename on artifacts")
    _create_index_if_not_exists(
        "ix_artifacts_run_id_filename",
        "artifacts",
        ["run_id", "filename"],
        unique=False,
    )


def downgrade() -> None:
    """Drop composite indexes on artifacts."""
    logger.info("Dropping composite index ix_artifacts_run_id_filename from artifacts")
    _drop_index_if_exists("ix_artifacts_run_id_filename", "artifacts")
    logger.info("Dropping composite index ix_artifacts_result_id_filename from artifacts")
    _drop_index_if_exists("ix_artifacts_result_id_filename", "artifacts")
