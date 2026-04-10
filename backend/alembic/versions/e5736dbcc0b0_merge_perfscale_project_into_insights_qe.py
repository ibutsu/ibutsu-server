"""merge_perfscale_project_into_insights_qe

Move all runs, results, dashboards, widget_configs, and user associations
from the hcc-perfscale-cpt project into the insights-qe project, then delete
the now-empty source project.

Updates are batched (BATCH_SIZE rows per commit) to keep lock windows short
and avoid timeouts on large tables.  Each batch is committed independently,
so the migration is safe to re-run if interrupted: already-migrated rows
have the target project_id and will not be touched again.

Revision ID: e5736dbcc0b0
Revises: 8cf9148b9ad9
Create Date: 2026-04-10 12:00:00.000000

"""

import logging

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e5736dbcc0b0"
down_revision = "8cf9148b9ad9"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")

FROM_PROJECT = "c6fd19a7-858a-4226-8c27-d8fa7ddf6d0c"  # hcc-perfscale-cpt
TO_PROJECT = "3915c900-85fc-1222-833c-10d51af56f2e"  # insights-qe
TO_PROJECT_NAME = "insights-qe"

BATCH_SIZE = 10_000

_ALLOWED_TABLES = frozenset({"runs", "results", "dashboards", "widget_configs"})

# SQL template for batched project_id migration.  {table} and {extra_set} are
# substituted at build time from hardcoded constants in upgrade(); all runtime
# values use SQLAlchemy bind parameters (:from_proj, :to_proj, :batch_size).
_BATCH_SQL = """
    WITH batch AS (
        SELECT id FROM {table}
        WHERE project_id = :from_proj
        LIMIT :batch_size
    )
    UPDATE {table}
    SET project_id = :to_proj{extra_set}
    WHERE id IN (SELECT id FROM batch)
"""


def _build_batch_sql(table, extra_set=""):
    """Build the batched UPDATE statement for a given table.

    Table and extra_set are validated / hardcoded by callers in upgrade() --
    they are never derived from external input.  All dynamic values flow
    through SQLAlchemy bind parameters (:from_proj, :to_proj, etc.).
    """
    if table not in _ALLOWED_TABLES:
        raise ValueError(f"table must be one of {_ALLOWED_TABLES}, got {table!r}")
    return sa.text(_BATCH_SQL.format(table=table, extra_set=extra_set))


def _batched_update(conn, table, extra_set="", params=None):
    """Update rows in batches, committing between each batch to release locks.

    Uses a CTE to SELECT a limited batch of IDs, then UPDATEs only those rows.
    Explicit COMMIT/BEGIN between batches keeps lock duration short.

    Safe to re-run: each batch only touches rows still pointing at
    FROM_PROJECT, so already-migrated rows are never revisited.
    """
    if params is None:
        params = {}
    params.setdefault("from_proj", FROM_PROJECT)
    params.setdefault("to_proj", TO_PROJECT)
    params.setdefault("batch_size", BATCH_SIZE)

    stmt = _build_batch_sql(table, extra_set)
    total = 0
    batch_num = 0
    while True:
        batch_num += 1
        result = conn.execute(stmt, params)
        moved = result.rowcount
        total += moved
        logger.info("  batch %d: updated %d %s rows (%d total)", batch_num, moved, table, total)

        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text("BEGIN"))

        if moved < BATCH_SIZE:
            break

    return total


def upgrade() -> None:
    """Move all data from hcc-perfscale-cpt into insights-qe, then delete the source project."""
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

    proj_json = f'{{"project": "{TO_PROJECT_NAME}"}}'

    logger.info("Moving runs...")
    _batched_update(
        conn,
        "runs",
        extra_set=", data = COALESCE(data, '{}'::jsonb) || :proj_json",
        params={"proj_json": proj_json},
    )

    logger.info("Moving results...")
    _batched_update(
        conn,
        "results",
        extra_set=", data = COALESCE(data, '{}'::jsonb) || :proj_json",
        params={"proj_json": proj_json},
    )

    logger.info("Moving dashboards...")
    _batched_update(conn, "dashboards")

    logger.info("Moving widget_configs...")
    _batched_update(conn, "widget_configs")

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

    conn.execute(
        sa.text("DELETE FROM users_projects WHERE project_id = :from_proj"),
        {"from_proj": FROM_PROJECT},
    )

    logger.info("Deleting source project...")
    conn.execute(
        sa.text("DELETE FROM projects WHERE id = :from_proj"),
        {"from_proj": FROM_PROJECT},
    )

    logger.info("Migration complete")


def downgrade() -> None:
    # Data migration -- downgrade is a no-op.
    # The source project and its data associations cannot be automatically
    # reconstructed. Restore from backup if rollback is needed.
    pass
