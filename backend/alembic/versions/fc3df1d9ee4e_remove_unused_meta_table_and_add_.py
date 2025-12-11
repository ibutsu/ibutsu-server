"""remove_unused_meta_table_and_add_production_indexes

Revision ID: fc3df1d9ee4e
Revises: cacecc4f1237
Create Date: 2025-12-10 20:35:28.432171

This migration performs two main operations:

1. Removes the unused 'meta' table which was previously used for database versioning
   but has been replaced by Alembic's version tracking.

2. Adds production performance indexes using PostgreSQL-specific features
   (JSON operators, GIN indexes). These indexes are ONLY created on PostgreSQL
   to maintain compatibility with SQLite in dev/test environments.

IMPORTANT: These indexes are the single source of truth for PostgreSQL-specific
indexes. They are NOT defined in the ORM models (models.py) to avoid breaking
SQLite. Any changes to these indexes must:
1. Be made in this migration file with proper dialect checks
2. Be documented in the Result/Run model docstrings in models.py

"""

import contextlib
import logging

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "fc3df1d9ee4e"
down_revision = "cacecc4f1237"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.fc3df1d9ee4e")


def _is_postgresql():
    """Check if the current database is PostgreSQL."""
    return op.get_bind().dialect.name == "postgresql"


def _table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


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
    """
    if not _is_postgresql():
        return
    if _index_exists(index_name, table_name):
        return
    op.create_index(index_name, table_name, columns, **kwargs)


def _drop_index_if_exists(index_name, table_name):
    """Idempotent index drop for PostgreSQL-specific indexes.

    Returns early if not on PostgreSQL or if index doesn't exist.
    """
    if not _is_postgresql():
        return
    if not _index_exists(index_name, table_name):
        return
    op.drop_index(index_name, table_name=table_name)


def _drop_meta_if_exists():
    """Drop the meta table if it exists."""
    if not _table_exists("meta"):
        return
    # Best-effort drop index (may not exist), then table
    with contextlib.suppress(Exception):
        op.drop_index(op.f("ix_meta_key"), table_name="meta")
    op.drop_table("meta")


def upgrade() -> None:
    logger.info("Starting migration fc3df1d9ee4e")

    # Step 1: Remove unused meta table
    _drop_meta_if_exists()

    if not _is_postgresql():
        logger.info("Non-PostgreSQL dialect; skipping PostgreSQL-specific indexes")
        return

    logger.info("Creating PostgreSQL-specific indexes on 'results' and 'runs'")

    # Index on assignee from metadata JSON field
    _create_index_if_not_exists(
        "ix_results_assignee", "results", [sa.text("(data ->> 'assignee')")], unique=False
    )

    # Index on classification from metadata JSON field
    _create_index_if_not_exists(
        "ix_results_classification",
        "results",
        [sa.text("(data ->> 'classification')")],
        unique=False,
    )

    # Composite index for component/env/project queries
    _create_index_if_not_exists(
        "ix_results_component_env_project",
        "results",
        ["component", "env", "project_id", sa.text("start_time DESC")],
        unique=False,
    )

    # Composite index for component/time/result/project queries
    _create_index_if_not_exists(
        "ix_results_component_start_time_result_project_id",
        "results",
        ["component", "start_time", "result", "project_id"],
        unique=False,
    )

    # Index on exception_name from metadata JSON field
    _create_index_if_not_exists(
        "ix_results_exception_name",
        "results",
        [sa.text("(data ->> 'exception_name')")],
        unique=False,
    )

    # Index on Jenkins build number from nested JSON field
    _create_index_if_not_exists(
        "ix_results_jenkins_build_number",
        "results",
        [sa.text("((data -> 'jenkins') ->> 'build_number')")],
        unique=False,
    )

    # Index on Jenkins job name from nested JSON field
    _create_index_if_not_exists(
        "ix_results_jenkins_job_name",
        "results",
        [sa.text("((data -> 'jenkins') ->> 'job_name')")],
        unique=False,
    )

    # GIN index on requirements array in metadata JSON field
    _create_index_if_not_exists(
        "ix_results_requirements",
        "results",
        [sa.text("(data -> 'requirements')")],
        unique=False,
        postgresql_using="gin",
    )

    # Composite index for Satellite version queries
    _create_index_if_not_exists(
        "ix_results_result_satver_project_id_run_id_snapver",
        "results",
        [
            "result",
            sa.text("(data ->> 'SatelliteVersion')"),
            "project_id",
            "run_id",
            sa.text("(data ->> 'SnapVersion')"),
        ],
        unique=False,
    )

    # GIN index on tags array in metadata JSON field
    _create_index_if_not_exists(
        "ix_results_tags",
        "results",
        [sa.text("(data -> 'tags')")],
        unique=False,
        postgresql_using="gin",
    )

    # Index on Jenkins build number from nested JSON field
    _create_index_if_not_exists(
        "ix_runs_jenkins_build_number",
        "runs",
        [sa.text("((data -> 'jenkins') ->> 'build_number')")],
        unique=False,
    )

    # Index on Jenkins job name from nested JSON field
    _create_index_if_not_exists(
        "ix_runs_jenkins_job_name",
        "runs",
        [sa.text("((data -> 'jenkins') ->> 'job_name')")],
        unique=False,
    )

    # Composite index on both Jenkins fields for efficient job/build lookups
    _create_index_if_not_exists(
        "ix_runs_jjn_jbn",
        "runs",
        [
            sa.text("((data -> 'jenkins') ->> 'job_name')"),
            sa.text("((data -> 'jenkins') ->> 'build_number')"),
        ],
        unique=False,
    )

    # GIN index on summary JSONB field for full-text and containment queries
    _create_index_if_not_exists(
        "ix_runs_summary", "runs", ["summary"], unique=False, postgresql_using="gin"
    )

    # GIN index on tags array in metadata JSON field
    _create_index_if_not_exists(
        "ix_runs_tags", "runs", [sa.text("(data -> 'tags')")], unique=False, postgresql_using="gin"
    )


def _create_meta_if_missing():
    """Recreate the meta table if it doesn't exist."""
    if _table_exists("meta"):
        return
    op.create_table(
        "meta",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index(op.f("ix_meta_key"), "meta", ["key"], unique=False)


def downgrade() -> None:
    logger.info("Starting downgrade fc3df1d9ee4e")

    if _is_postgresql():
        logger.info("Dropping PostgreSQL-specific indexes on 'results' and 'runs'")
        _drop_index_if_exists("ix_runs_tags", "runs")
        _drop_index_if_exists("ix_runs_summary", "runs")
        _drop_index_if_exists("ix_runs_jjn_jbn", "runs")
        _drop_index_if_exists("ix_runs_jenkins_job_name", "runs")
        _drop_index_if_exists("ix_runs_jenkins_build_number", "runs")
        _drop_index_if_exists("ix_results_tags", "results")
        _drop_index_if_exists("ix_results_result_satver_project_id_run_id_snapver", "results")
        _drop_index_if_exists("ix_results_requirements", "results")
        _drop_index_if_exists("ix_results_jenkins_job_name", "results")
        _drop_index_if_exists("ix_results_jenkins_build_number", "results")
        _drop_index_if_exists("ix_results_exception_name", "results")
        _drop_index_if_exists("ix_results_component_start_time_result_project_id", "results")
        _drop_index_if_exists("ix_results_component_env_project", "results")
        _drop_index_if_exists("ix_results_classification", "results")
        _drop_index_if_exists("ix_results_assignee", "results")

    _create_meta_if_missing()
