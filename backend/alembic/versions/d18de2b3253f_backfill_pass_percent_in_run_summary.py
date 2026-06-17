"""backfill_pass_percent_in_run_summary

Backfill pass_percent into the summary JSON blob for all existing runs,
and create a B-tree expression index for fast range filtering.

PostgreSQL only -- skipped on SQLite (dev/test environments).

Revision ID: d18de2b3253f
Revises: e5736dbcc0b0
Create Date: 2026-05-18 19:30:00.000000

"""

import logging

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "d18de2b3253f"
down_revision = "e5736dbcc0b0"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.d18de2b3253f")

BATCH_SIZE = 5000

# Canonical pass_percent formula: floor(passes * 100 / tests), clamped to
# [0, 100].  This matches the runtime calculation in
# ibutsu_server/tasks/runs.py (update_run) and the frontend fallback in
# frontend/src/utilities/run.js (getRunPassPercent).
#
# Non-passing outcomes subtracted when deriving passes (old runs that lack an
# explicit "passes" key): failures, errors, skips, xpasses, xfailures.
# If this list changes, update update_run and getRunPassPercent as well.
#
# The query uses two CTEs because PostgreSQL does not allow referencing column
# aliases defined in the same SELECT list.  ``parsed`` extracts numeric values
# from the JSONB summary once, and ``computed`` derives pass_percent from them.
# A LIMIT on ``parsed`` keeps each batch bounded.
_BACKFILL_BATCH_SQL = sa.text("""\
WITH parsed AS (
    SELECT
        id,
        CASE WHEN summary->>'tests' ~ '^[0-9]+$'
             THEN (summary->>'tests')::numeric
        END AS tests_num,
        CASE WHEN summary->>'passes' ~ '^[0-9]+$'
             THEN (summary->>'passes')::numeric
        END AS passes_num,
        COALESCE(
            CASE WHEN summary->>'failures' ~ '^[0-9]+$'
                 THEN (summary->>'failures')::numeric
            END, 0) AS failures_num,
        COALESCE(
            CASE WHEN summary->>'errors' ~ '^[0-9]+$'
                 THEN (summary->>'errors')::numeric
            END, 0) AS errors_num,
        COALESCE(
            CASE WHEN summary->>'skips' ~ '^[0-9]+$'
                 THEN (summary->>'skips')::numeric
            END, 0) AS skips_num,
        COALESCE(
            CASE WHEN summary->>'xpasses' ~ '^[0-9]+$'
                 THEN (summary->>'xpasses')::numeric
            END, 0) AS xpasses_num,
        COALESCE(
            CASE WHEN summary->>'xfailures' ~ '^[0-9]+$'
                 THEN (summary->>'xfailures')::numeric
            END, 0) AS xfailures_num
    FROM runs
    WHERE summary IS NOT NULL
      AND summary->'pass_percent' IS NULL
    LIMIT :batch_size
),
computed AS (
    SELECT
        id,
        CASE
            WHEN tests_num IS NOT NULL
             AND tests_num > 0
             AND passes_num IS NOT NULL
            THEN LEAST(GREATEST(
                floor(passes_num * 100 / tests_num)::int,
                0), 100)
        END AS pass_pct_direct,
        CASE
            WHEN tests_num IS NOT NULL
             AND tests_num > 0
             AND passes_num IS NULL
            THEN LEAST(GREATEST(
                floor((
                    tests_num
                    - failures_num
                    - errors_num
                    - skips_num
                    - xpasses_num
                    - xfailures_num
                ) * 100 / tests_num)::int,
                0), 100)
        END AS pass_pct_derived
    FROM parsed
)
UPDATE runs AS r
SET summary = jsonb_set(
    COALESCE(r.summary, '{}'::jsonb),
    '{pass_percent}',
    to_jsonb(COALESCE(c.pass_pct_direct, c.pass_pct_derived, 0))
)
FROM computed AS c
WHERE r.id = c.id
""")


def upgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError(
            "This migration requires a live database connection and does not support "
            "offline SQL generation (alembic upgrade --sql). Run in online mode."
        )

    bind = op.get_bind()

    # The backfill and index use PostgreSQL-specific JSON operators and
    # expression indexes.  SQLite (used in dev/test) has no runs with
    # production data, so skipping is safe there.
    if bind.dialect.name != "postgresql":
        logger.info("Non-PostgreSQL dialect; skipping pass_percent backfill")
        return

    logger.info("Starting migration d18de2b3253f: backfill pass_percent")

    # Use a separate connection for the batched backfill to avoid conflicting
    # with Alembic's transaction management.  Each batch gets its own explicit
    # transaction so row locks are released between iterations.  The query is
    # idempotent (filters on summary->'pass_percent' IS NULL), so a failure
    # mid-loop is safe to re-run.
    engine = bind.engine
    total_updated = 0
    with engine.connect() as backfill_conn:
        while True:
            with backfill_conn.begin():
                result = backfill_conn.execute(_BACKFILL_BATCH_SQL, {"batch_size": BATCH_SIZE})
                batch_count = result.rowcount
                total_updated += batch_count
                logger.info("  batch: %d rows updated", batch_count)
            if batch_count < BATCH_SIZE:
                break

    logger.info("Backfilled pass_percent for %d runs total", total_updated)

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
    # Use a separate connection with AUTOCOMMIT isolation level so that
    # PostgreSQL allows the concurrent index build without conflicting with
    # Alembic's transaction management.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as idx_conn:
        idx_conn.execute(
            sa.text(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_runs_pass_percent "
                "ON runs (((summary->>'pass_percent')::int))"
            )
        )
    logger.info("Created ix_runs_pass_percent index (CONCURRENTLY)")


def downgrade() -> None:
    # Drops the expression index only.  The backfilled pass_percent values are
    # left in place intentionally: removing them would require re-deriving each
    # value and risks data loss if the source counters have since been modified.
    # Re-running upgrade() after a downgrade is safe because the CTE filters on
    # summary->'pass_percent' IS NULL, so already-populated rows are skipped.
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    op.drop_index("ix_runs_pass_percent", table_name="runs", if_exists=True)
