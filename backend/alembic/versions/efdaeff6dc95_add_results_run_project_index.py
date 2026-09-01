"""add_results_run_project_index

Revision ID: efdaeff6dc95
Revises: d18de2b3253f
Create Date: 2026-08-24 11:50:00.658487

Add composite index on (run_id, project_id) for results table to optimize
queries on runs with missing component/env metadata. This addresses timeout
issues when querying large result sets filtered only by run_id and project_id.

"""

import logging

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "efdaeff6dc95"
down_revision = "d18de2b3253f"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.efdaeff6dc95")


def _is_postgresql():
    """Check if the current database is PostgreSQL."""
    return op.get_bind().dialect.name == "postgresql"


def _index_exists(index_name, table_name) -> bool:
    """Check if an index already exists in PostgreSQL.

    IMPORTANT: This function uses PostgreSQL-specific pg_indexes catalog.
    It must only be called when running on PostgreSQL (after _is_postgresql() check).
    """
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
    """Idempotent index creation for PostgreSQL-specific indexes.

    Returns early if not on PostgreSQL or if index already exists.
    Creates the index CONCURRENTLY to avoid blocking writes.
    """
    if not _is_postgresql():
        return
    if _index_exists(index_name, table_name):
        logger.info(f"Index {index_name} already exists, skipping creation")
        return
    logger.info(f"Creating index {index_name} on {table_name} CONCURRENTLY")
    op.create_index(index_name, table_name, columns, postgresql_concurrently=True, **kwargs)


def _drop_index_if_exists(index_name, table_name):
    """Idempotent index drop for PostgreSQL-specific indexes.

    Returns early if not on PostgreSQL or if index doesn't exist.
    """
    if not _is_postgresql():
        return
    if not _index_exists(index_name, table_name):
        logger.info(f"Index {index_name} does not exist, skipping drop")
        return
    logger.info(f"Dropping index {index_name} from {table_name}")
    op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    logger.info("Starting migration efdaeff6dc95")

    if not _is_postgresql():
        logger.info("Non-PostgreSQL dialect; skipping PostgreSQL-specific indexes")
        return

    logger.info("Creating composite index on (run_id, project_id) for results table")

    # Create index concurrently to avoid blocking writes on large tables
    # This requires autocommit mode (no transaction)
    with op.get_context().autocommit_block():
        # Composite index for run_id + project_id queries (common pattern for run pages)
        _create_index_if_not_exists(
            "ix_results_run_id_project_id",
            "results",
            ["run_id", "project_id"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade: drop the composite index.

    NOTE: This downgrade will drop the index even if it existed before this migration.
    We cannot reliably track index ownership across migration boundaries without
    additional infrastructure. If the index pre-existed, downgrading will remove it.
    For safety in production, consider keeping the index (it's relatively harmless)
    rather than downgrading.
    """
    logger.info("Starting downgrade efdaeff6dc95")

    if not _is_postgresql():
        logger.info("Non-PostgreSQL dialect; skipping PostgreSQL-specific indexes")
        return

    logger.info("Dropping composite index on (run_id, project_id) from results table")

    # Drop concurrently to avoid blocking writes
    with op.get_context().autocommit_block():
        if _index_exists("ix_results_run_id_project_id", "results"):
            logger.info("Dropping index ix_results_run_id_project_id from results")
            op.drop_index(
                "ix_results_run_id_project_id",
                table_name="results",
                postgresql_concurrently=True,
            )
        else:
            logger.info("Index ix_results_run_id_project_id does not exist, skipping drop")
