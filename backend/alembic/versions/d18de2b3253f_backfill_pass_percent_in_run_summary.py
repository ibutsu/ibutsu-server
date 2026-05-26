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

from alembic import op

# revision identifiers, used by Alembic.
revision = "d18de2b3253f"
down_revision = "e5736dbcc0b0"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.d18de2b3253f")


def upgrade() -> None:
    logger.info("Starting migration d18de2b3253f: backfill pass_percent")

    conn = op.get_bind()

    # The backfill and index use PostgreSQL-specific JSON operators and
    # expression indexes.  SQLite (used in dev/test) has no runs with
    # production data, so skipping is safe there.
    if conn.dialect.name != "postgresql":
        logger.info("Non-PostgreSQL dialect; skipping pass_percent backfill")
        return

    # Canonical pass_percent formula: floor(passes * 100 / tests), clamped
    # to [0, 100].  This matches the runtime calculation in
    # ibutsu_server/tasks/runs.py (update_run) and the frontend fallback in
    # frontend/src/utilities/run.js (getRunPassPercent).
    #
    # Non-passing outcomes subtracted when deriving passes (old runs that
    # lack an explicit "passes" key): failures, errors, skips, xpasses,
    # xfailures.  If this list changes, update update_run and
    # getRunPassPercent as well.
    result = conn.execute(
        sa.text(
            """
            WITH normalized AS (
                SELECT
                    id,
                    -- Parse each counter once; tests/passes NULL when absent
                    -- or non-numeric, loss counters default to 0.
                    CASE WHEN summary->>'tests'   ~ '^[0-9]+$'
                         THEN (summary->>'tests')::numeric   END AS tests_num,
                    CASE WHEN summary->>'passes'  ~ '^[0-9]+$'
                         THEN (summary->>'passes')::numeric  END AS passes_num,
                    COALESCE(
                        CASE WHEN summary->>'failures'  ~ '^[0-9]+$'
                             THEN (summary->>'failures')::numeric  END, 0
                    ) AS failures_num,
                    COALESCE(
                        CASE WHEN summary->>'errors'    ~ '^[0-9]+$'
                             THEN (summary->>'errors')::numeric    END, 0
                    ) AS errors_num,
                    COALESCE(
                        CASE WHEN summary->>'skips'     ~ '^[0-9]+$'
                             THEN (summary->>'skips')::numeric     END, 0
                    ) AS skips_num,
                    COALESCE(
                        CASE WHEN summary->>'xpasses'   ~ '^[0-9]+$'
                             THEN (summary->>'xpasses')::numeric   END, 0
                    ) AS xpasses_num,
                    COALESCE(
                        CASE WHEN summary->>'xfailures' ~ '^[0-9]+$'
                             THEN (summary->>'xfailures')::numeric END, 0
                    ) AS xfailures_num,

                    -- Precompute: direct path (passes key present)
                    CASE
                        WHEN summary->>'tests'  ~ '^[0-9]+$'
                         AND (summary->>'tests')::numeric > 0
                         AND summary->>'passes' ~ '^[0-9]+$'
                        THEN LEAST(GREATEST(
                            floor(
                                (summary->>'passes')::numeric * 100
                                / (summary->>'tests')::numeric
                            )::int,
                            0), 100)
                    END AS pass_percent_direct,

                    -- Precompute: derived path (passes key absent)
                    CASE
                        WHEN summary->>'tests'  ~ '^[0-9]+$'
                         AND (summary->>'tests')::numeric > 0
                         AND NOT (summary ? 'passes')
                        THEN LEAST(GREATEST(
                            floor(
                                (
                                    (summary->>'tests')::numeric
                                    - COALESCE(CASE WHEN summary->>'failures'  ~ '^[0-9]+$' THEN (summary->>'failures')::numeric  END, 0)
                                    - COALESCE(CASE WHEN summary->>'errors'    ~ '^[0-9]+$' THEN (summary->>'errors')::numeric    END, 0)
                                    - COALESCE(CASE WHEN summary->>'skips'     ~ '^[0-9]+$' THEN (summary->>'skips')::numeric     END, 0)
                                    - COALESCE(CASE WHEN summary->>'xpasses'   ~ '^[0-9]+$' THEN (summary->>'xpasses')::numeric   END, 0)
                                    - COALESCE(CASE WHEN summary->>'xfailures' ~ '^[0-9]+$' THEN (summary->>'xfailures')::numeric END, 0)
                                ) * 100
                                / (summary->>'tests')::numeric
                            )::int,
                            0), 100)
                    END AS pass_percent_derived

                FROM runs
                WHERE summary IS NOT NULL
                  AND summary->'pass_percent' IS NULL
            )
            UPDATE runs AS r
            SET summary = jsonb_set(
                COALESCE(r.summary, '{}'::jsonb),
                '{pass_percent}',
                to_jsonb(COALESCE(n.pass_percent_direct, n.pass_percent_derived, 0))
            )
            FROM normalized AS n
            WHERE r.id = n.id
            """
        )
    )
    logger.info("Backfilled pass_percent for %d runs", result.rowcount)

    # Expression index on the integer cast of summary->>'pass_percent' so that
    # range filter queries (e.g. pass_percent >= 80) can use an index scan
    # rather than a full sequential scan over the JSONB column.
    op.create_index(
        "ix_runs_pass_percent",
        "runs",
        [sa.text("((summary->>'pass_percent')::int)")],
        unique=False,
        postgresql_using="btree",
        if_not_exists=True,
    )
    logger.info("Created ix_runs_pass_percent index")


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
