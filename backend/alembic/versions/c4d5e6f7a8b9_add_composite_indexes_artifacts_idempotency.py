"""add_composite_indexes_artifacts_idempotency

Add composite indexes backing importer idempotency lookups:
- on artifacts: (result_id, filename) and (run_id, filename) for archive imports
- on results: (run_id, test_id) for JUnit importer per-testcase lookups

Revision ID: c4d5e6f7a8b9
Revises: efdaeff6dc95
Create Date: 2026-08-27 00:00:00.000000

"""

import logging

from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "efdaeff6dc95"
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
    """Create composite indexes on artifacts and results for import idempotency lookups."""
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
    logger.info("Creating composite index ix_results_run_id_test_id on results")
    _create_index_if_not_exists(
        "ix_results_run_id_test_id",
        "results",
        ["run_id", "test_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop composite indexes on artifacts and results."""
    logger.info("Dropping composite index ix_results_run_id_test_id from results")
    _drop_index_if_exists("ix_results_run_id_test_id", "results")
    logger.info("Dropping composite index ix_artifacts_run_id_filename from artifacts")
    _drop_index_if_exists("ix_artifacts_run_id_filename", "artifacts")
    logger.info("Dropping composite index ix_artifacts_result_id_filename from artifacts")
    _drop_index_if_exists("ix_artifacts_result_id_filename", "artifacts")
