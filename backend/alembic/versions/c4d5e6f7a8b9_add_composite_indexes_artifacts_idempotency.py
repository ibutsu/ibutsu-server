"""add_composite_indexes_artifacts_idempotency

Add composite indexes backing importer idempotency lookups:
- on artifacts: (result_id, filename) and (run_id, filename) for archive imports
- on results: (run_id, test_id) for JUnit importer per-testcase lookups

Revision ID: c4d5e6f7a8b9
Revises: efdaeff6dc95
Create Date: 2026-08-27 00:00:00.000000

"""

import contextlib
import logging

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "efdaeff6dc95"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.c4d5e6f7a8b9")

INDEXES = [
    ("ix_artifacts_result_id_filename", "artifacts", ["result_id", "filename"]),
    ("ix_artifacts_run_id_filename", "artifacts", ["run_id", "filename"]),
    ("ix_results_run_id_test_id", "results", ["run_id", "test_id"]),
]

_INVALID_INDEX_SQL = sa.text(
    """
    SELECT i.indisvalid
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = :index_name
      AND n.nspname = current_schema()
    """
)


def _is_postgresql() -> bool:
    """Check if the current database dialect is PostgreSQL."""
    bind = op.get_bind()
    if bind:
        return bind.dialect.name == "postgresql"
    return op.get_context().dialect.name == "postgresql"


def _is_offline() -> bool:
    """Check if Alembic is running in offline mode."""
    with contextlib.suppress(NameError, AttributeError):
        return context.is_offline_mode()
    return getattr(op.get_context(), "as_sql", False)


def _cleanup_invalid_index(index_name: str, table_name: str) -> None:
    """Drop index if left in an INVALID state by an interrupted concurrent run."""
    if _is_offline():
        return
    conn = op.get_bind()
    if conn is None:
        return
    row = conn.execute(_INVALID_INDEX_SQL, {"index_name": index_name}).fetchone()
    if row and not row[0]:
        logger.warning("Found invalid index %s; dropping before recreating", index_name)
        op.drop_index(
            index_name,
            table_name=table_name,
            postgresql_concurrently=True,
            if_exists=True,
        )


def upgrade() -> None:
    """Create composite indexes on artifacts and results for import idempotency lookups."""
    logger.info("Starting migration %s", revision)

    if _is_postgresql():
        with op.get_context().autocommit_block():
            for index_name, table_name, columns in INDEXES:
                _cleanup_invalid_index(index_name, table_name)
                logger.info(
                    "Creating index %s on %s CONCURRENTLY (PostgreSQL)",
                    index_name,
                    table_name,
                )
                op.create_index(
                    index_name,
                    table_name,
                    columns,
                    unique=False,
                    postgresql_concurrently=True,
                    if_not_exists=True,
                )
    else:
        for index_name, table_name, columns in INDEXES:
            logger.info("Creating index %s on %s (non-PostgreSQL)", index_name, table_name)
            op.create_index(
                index_name,
                table_name,
                columns,
                unique=False,
                if_not_exists=True,
            )


def downgrade() -> None:
    """Drop composite indexes on artifacts and results."""
    logger.info("Starting downgrade %s", revision)

    if _is_postgresql():
        with op.get_context().autocommit_block():
            for index_name, table_name, _ in reversed(INDEXES):
                logger.info(
                    "Dropping index %s from %s CONCURRENTLY (PostgreSQL)",
                    index_name,
                    table_name,
                )
                op.drop_index(
                    index_name,
                    table_name=table_name,
                    postgresql_concurrently=True,
                    if_exists=True,
                )
    else:
        for index_name, table_name, _ in reversed(INDEXES):
            logger.info("Dropping index %s from %s (non-PostgreSQL)", index_name, table_name)
            op.drop_index(
                index_name,
                table_name=table_name,
                if_exists=True,
            )
