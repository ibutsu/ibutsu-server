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

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "fc3df1d9ee4e"
down_revision = "cacecc4f1237"
branch_labels = None
depends_on = None


def _is_postgresql():
    """Check if the current database is PostgreSQL."""
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    # ========================================
    # Step 1: Remove unused meta table
    # ========================================
    # The 'meta' table was used for database versioning in the old upgrade system.
    # With Alembic, this table is no longer needed. Production has only 1 record in it.
    op.drop_index(op.f("ix_meta_key"), table_name="meta")
    op.drop_table("meta")

    # ========================================
    # Step 2: Add PostgreSQL-specific performance indexes
    # ========================================
    # These indexes use PostgreSQL-specific features (JSON operators, GIN indexes)
    # and are only created when running on PostgreSQL. SQLite and other databases
    # will skip these index creations.

    if not _is_postgresql():
        # Skip PostgreSQL-specific index creation on non-PostgreSQL databases
        return

    # ========================================
    # Step 2a: Add production performance indexes for 'results' table
    # ========================================
    # These indexes optimize query performance for common query patterns.

    # Index on assignee from metadata JSON field
    op.create_index(
        "ix_results_assignee", "results", [sa.text("(data ->> 'assignee')")], unique=False
    )

    # Index on classification from metadata JSON field
    op.create_index(
        "ix_results_classification",
        "results",
        [sa.text("(data ->> 'classification')")],
        unique=False,
    )

    # Composite index for component/env/project queries
    op.create_index(
        "ix_results_component_env_project",
        "results",
        ["component", "env", "project_id", sa.text("start_time DESC")],
        unique=False,
    )

    # Composite index for component/time/result/project queries
    op.create_index(
        "ix_results_component_start_time_result_project_id",
        "results",
        ["component", "start_time", "result", "project_id"],
        unique=False,
    )

    # Index on exception_name from metadata JSON field
    op.create_index(
        "ix_results_exception_name",
        "results",
        [sa.text("(data ->> 'exception_name')")],
        unique=False,
    )

    # Index on Jenkins build number from nested JSON field
    op.create_index(
        "ix_results_jenkins_build_number",
        "results",
        [sa.text("((data -> 'jenkins') ->> 'build_number')")],
        unique=False,
    )

    # Index on Jenkins job name from nested JSON field
    op.create_index(
        "ix_results_jenkins_job_name",
        "results",
        [sa.text("((data -> 'jenkins') ->> 'job_name')")],
        unique=False,
    )

    # GIN index on requirements array in metadata JSON field
    op.create_index(
        "ix_results_requirements",
        "results",
        [sa.text("(data -> 'requirements')")],
        unique=False,
        postgresql_using="gin",
    )

    # Composite index for Satellite version queries
    op.create_index(
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
    op.create_index(
        "ix_results_tags",
        "results",
        [sa.text("(data -> 'tags')")],
        unique=False,
        postgresql_using="gin",
    )

    # ========================================
    # Step 2b: Add production performance indexes for 'runs' table
    # ========================================
    # These indexes optimize query performance for common query patterns on the runs table.

    # Index on Jenkins build number from nested JSON field
    op.create_index(
        "ix_runs_jenkins_build_number",
        "runs",
        [sa.text("((data -> 'jenkins') ->> 'build_number')")],
        unique=False,
    )

    # Index on Jenkins job name from nested JSON field
    op.create_index(
        "ix_runs_jenkins_job_name",
        "runs",
        [sa.text("((data -> 'jenkins') ->> 'job_name')")],
        unique=False,
    )

    # Composite index on both Jenkins fields for efficient job/build lookups
    op.create_index(
        "ix_runs_jjn_jbn",
        "runs",
        [
            sa.text("((data -> 'jenkins') ->> 'job_name')"),
            sa.text("((data -> 'jenkins') ->> 'build_number')"),
        ],
        unique=False,
    )

    # GIN index on summary JSONB field for full-text and containment queries
    op.create_index("ix_runs_summary", "runs", ["summary"], unique=False, postgresql_using="gin")

    # GIN index on tags array in metadata JSON field
    op.create_index(
        "ix_runs_tags", "runs", [sa.text("(data -> 'tags')")], unique=False, postgresql_using="gin"
    )


def downgrade() -> None:
    # ========================================
    # Step 1: Remove PostgreSQL-specific performance indexes
    # ========================================
    # Only attempt to drop these indexes if running on PostgreSQL,
    # since they were only created on PostgreSQL.

    if _is_postgresql():
        # ========================================
        # Step 1a: Remove production performance indexes from 'runs' table
        # ========================================
        op.drop_index("ix_runs_tags", table_name="runs")
        op.drop_index("ix_runs_summary", table_name="runs")
        op.drop_index("ix_runs_jjn_jbn", table_name="runs")
        op.drop_index("ix_runs_jenkins_job_name", table_name="runs")
        op.drop_index("ix_runs_jenkins_build_number", table_name="runs")

        # ========================================
        # Step 1b: Remove production performance indexes from 'results' table
        # ========================================
        op.drop_index("ix_results_tags", table_name="results")
        op.drop_index("ix_results_result_satver_project_id_run_id_snapver", table_name="results")
        op.drop_index("ix_results_requirements", table_name="results")
        op.drop_index("ix_results_jenkins_job_name", table_name="results")
        op.drop_index("ix_results_jenkins_build_number", table_name="results")
        op.drop_index("ix_results_exception_name", table_name="results")
        op.drop_index("ix_results_component_start_time_result_project_id", table_name="results")
        op.drop_index("ix_results_component_env_project", table_name="results")
        op.drop_index("ix_results_classification", table_name="results")
        op.drop_index("ix_results_assignee", table_name="results")

    # ========================================
    # Step 2: Recreate the meta table
    # ========================================
    # Note: This would restore the table structure, but not any data that was in it.
    # The data in the meta table is no longer needed with Alembic version tracking.
    op.create_table(
        "meta",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index(op.f("ix_meta_key"), "meta", ["key"], unique=False)
