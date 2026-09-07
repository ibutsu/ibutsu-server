"""add_results_run_project_index

Add composite index on (run_id, project_id) for results table to optimize
queries on runs with missing component/env metadata. This addresses timeout
issues when querying large result sets filtered only by run_id and project_id.

Revision ID: efdaeff6dc95
Revises: d18de2b3253f
Create Date: 2026-08-24 11:50:00.658487

"""

import contextlib
import logging

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "efdaeff6dc95"
down_revision = "d18de2b3253f"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.efdaeff6dc95")

INDEX_NAME = "ix_results_run_id_project_id"
TABLE_NAME = "results"
COLUMNS = ["run_id", "project_id"]

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


def _cleanup_invalid_index() -> None:
    """Drop index if left in an INVALID state by an interrupted concurrent run."""
    if _is_offline():
        return
    conn = op.get_bind()
    if conn is None:
        return
    row = conn.execute(_INVALID_INDEX_SQL, {"index_name": INDEX_NAME}).fetchone()
    if row and not row[0]:
        logger.warning("Found invalid index %s; dropping before recreating", INDEX_NAME)
        op.drop_index(
            INDEX_NAME,
            table_name=TABLE_NAME,
            postgresql_concurrently=True,
            if_exists=True,
        )


def upgrade() -> None:
    logger.info("Starting migration %s", revision)

    if _is_postgresql():
        logger.info(
            "Creating index %s on %s CONCURRENTLY (PostgreSQL)",
            INDEX_NAME,
            TABLE_NAME,
        )
        # Create index concurrently in an autocommit block to avoid blocking writes
        with op.get_context().autocommit_block():
            _cleanup_invalid_index()
            op.create_index(
                INDEX_NAME,
                TABLE_NAME,
                COLUMNS,
                unique=False,
                postgresql_concurrently=True,
                if_not_exists=True,
            )
    else:
        logger.info("Creating index %s on %s (non-PostgreSQL)", INDEX_NAME, TABLE_NAME)
        op.create_index(
            INDEX_NAME,
            TABLE_NAME,
            COLUMNS,
            unique=False,
            if_not_exists=True,
        )


def downgrade() -> None:
    logger.info("Starting downgrade %s", revision)

    if _is_postgresql():
        logger.info(
            "Dropping index %s from %s CONCURRENTLY (PostgreSQL)",
            INDEX_NAME,
            TABLE_NAME,
        )
        with op.get_context().autocommit_block():
            op.drop_index(
                INDEX_NAME,
                table_name=TABLE_NAME,
                postgresql_concurrently=True,
                if_exists=True,
            )
    else:
        logger.info(
            "Dropping index %s from %s (non-PostgreSQL)",
            INDEX_NAME,
            TABLE_NAME,
        )
        op.drop_index(
            INDEX_NAME,
            table_name=TABLE_NAME,
            if_exists=True,
        )
