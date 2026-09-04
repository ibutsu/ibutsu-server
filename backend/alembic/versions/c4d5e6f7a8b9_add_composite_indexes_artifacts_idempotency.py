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

from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "d18de2b3253f"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.c4d5e6f7a8b9")


def _index_exists(index_name: str, table_name: str) -> bool:
    """Check if an index already exists using dialect-agnostic inspection."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def _create_index_if_not_exists(index_name: str, table_name: str, columns: list, **kwargs) -> None:
    """Idempotent index creation across all supported database dialects."""
    if _index_exists(index_name, table_name):
        logger.info(f"Index {index_name} already exists on {table_name}, skipping creation")
        return
    op.create_index(index_name, table_name, columns, **kwargs)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    """Idempotent index drop across all supported database dialects."""
    if not _index_exists(index_name, table_name):
        logger.info(f"Index {index_name} does not exist on {table_name}, skipping drop")
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
