"""merge_perfscale_project_into_insights_qe

Move all runs, results, dashboards, widget_configs, and user associations
from the hcc-perfscale-cpt project into the insights-qe project.

The source project is intentionally NOT deleted here because it may still
have FK references from tables not handled by this migration (e.g. artifacts).
Clean up the empty project manually after verifying the migration succeeded.

All operations use Alembic's managed connection so that the data changes
and the alembic_version update commit atomically.

Revision ID: e5736dbcc0b0
Revises: 8cf9148b9ad9
Create Date: 2026-04-10 12:00:00.000000

"""

import logging

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "e5736dbcc0b0"
down_revision = "8cf9148b9ad9"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")

FROM_PROJECT = "c6fd19a7-858a-4226-8c27-d8fa7ddf6d0c"  # hcc-perfscale-cpt
TO_PROJECT = "3915c900-85fc-1222-833c-10d51af56f2e"  # insights-qe
TO_PROJECT_NAME = "insights-qe"


_ALLOWED_TABLES = frozenset({"runs", "results", "dashboards", "widget_configs"})


def _move_rows(conn, table, extra_set="", params=None):
    """Move all rows in *table* from FROM_PROJECT to TO_PROJECT.

    Uses the Alembic-managed connection so changes commit atomically
    with the alembic_version update.
    """
    if table not in _ALLOWED_TABLES:
        raise ValueError(f"table must be one of {_ALLOWED_TABLES}, got {table!r}")
    if params is None:
        params = {}
    params.setdefault("from_proj", FROM_PROJECT)
    params.setdefault("to_proj", TO_PROJECT)

    stmt = sa.text(
        f"UPDATE {table} SET project_id = :to_proj{extra_set} WHERE project_id = :from_proj"  # noqa: S608
    )
    result = conn.execute(stmt, params)
    logger.info("  updated %d %s rows", result.rowcount, table)
    return result.rowcount


def upgrade() -> None:
    """Move all data from hcc-perfscale-cpt into insights-qe."""
    if context.is_offline_mode():
        raise RuntimeError(
            "This migration requires a live database connection and does not support "
            "offline SQL generation (alembic upgrade --sql). Run this migration in "
            "online mode."
        )

    conn = op.get_bind()

    # Guard: skip if source project doesn't exist (already migrated or different env)
    result = conn.execute(
        sa.text("SELECT id FROM projects WHERE id = :pid"),
        {"pid": FROM_PROJECT},
    )
    if result.fetchone() is None:
        logger.info("Source project %s not found, skipping migration", FROM_PROJECT)
        return

    # Guard: target project must exist
    result = conn.execute(
        sa.text("SELECT id FROM projects WHERE id = :pid"),
        {"pid": TO_PROJECT},
    )
    if result.fetchone() is None:
        raise RuntimeError(f"Target project {TO_PROJECT} does not exist")

    extra_set = ""
    extra_params = {}
    if conn.dialect.name == "postgresql":
        proj_json = f'{{"project": "{TO_PROJECT_NAME}"}}'
        extra_set = ", data = COALESCE(data, '{}'::jsonb) || CAST(:proj_json AS jsonb)"
        extra_params = {"proj_json": proj_json}

    logger.info("Moving runs...")
    _move_rows(conn, "runs", extra_set=extra_set, params=dict(extra_params))

    logger.info("Moving results...")
    _move_rows(conn, "results", extra_set=extra_set, params=dict(extra_params))

    logger.info("Moving dashboards...")
    _move_rows(conn, "dashboards")

    logger.info("Moving widget_configs...")
    _move_rows(conn, "widget_configs")

    logger.info("Migrating users_projects...")
    conn.execute(
        sa.text(
            """
            INSERT INTO users_projects (user_id, project_id)
            SELECT user_id, :to_proj FROM users_projects
            WHERE project_id = :from_proj
            AND user_id NOT IN (
                SELECT user_id FROM users_projects WHERE project_id = :to_proj
            )
            """
        ),
        {"to_proj": TO_PROJECT, "from_proj": FROM_PROJECT},
    )

    logger.info("Migration complete")


def downgrade() -> None:
    # Data migration -- downgrade is a no-op.
    # The source project and its data associations cannot be automatically
    # reconstructed. Restore from backup if rollback is needed.
    pass
