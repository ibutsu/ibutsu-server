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

    result = conn.execute(
        sa.text(
            """
            -- Normalize each counter field from text to numeric exactly once so
            -- the UPDATE expression stays shallow and avoids repeating casts and
            -- regex guards.  Fields that are absent or non-numeric are coerced to
            -- NULL (tests/passes, which drive branching) or 0 (loss counters,
            -- which default-to-zero is safe for subtraction arithmetic).
            WITH normalized AS (
                SELECT
                    id,
                    CASE
                        WHEN summary->>'tests' ~ '^[0-9]+$'
                        THEN (summary->>'tests')::numeric
                        ELSE NULL
                    END AS tests_num,
                    CASE
                        WHEN summary->>'passes' ~ '^[0-9]+$'
                        THEN (summary->>'passes')::numeric
                        ELSE NULL
                    END AS passes_num,
                    -- Loss counters default to 0 so the derived-passes arithmetic
                    -- below stays correct even when a counter key is missing.
                    CASE
                        WHEN summary->>'failures' ~ '^[0-9]+$'
                        THEN (summary->>'failures')::numeric
                        ELSE 0
                    END AS failures_num,
                    CASE
                        WHEN summary->>'errors' ~ '^[0-9]+$'
                        THEN (summary->>'errors')::numeric
                        ELSE 0
                    END AS errors_num,
                    CASE
                        WHEN summary->>'skips' ~ '^[0-9]+$'
                        THEN (summary->>'skips')::numeric
                        ELSE 0
                    END AS skips_num,
                    -- xpasses and xfailures count as non-passing outcomes and are
                    -- subtracted when deriving passes from counters.
                    CASE
                        WHEN summary->>'xpasses' ~ '^[0-9]+$'
                        THEN (summary->>'xpasses')::numeric
                        ELSE 0
                    END AS xpasses_num,
                    CASE
                        WHEN summary->>'xfailures' ~ '^[0-9]+$'
                        THEN (summary->>'xfailures')::numeric
                        ELSE 0
                    END AS xfailures_num
                FROM runs
                WHERE summary IS NOT NULL
                  AND summary->'pass_percent' IS NULL   -- skip already-backfilled rows
            )
            UPDATE runs AS r
            SET summary = jsonb_set(
                COALESCE(r.summary, '{}'::jsonb),
                '{pass_percent}',
                to_jsonb(
                    CASE
                        -- Modern runs that recorded a 'passes' counter directly.
                        -- This is the preferred path; divide passes by tests.
                        WHEN n.tests_num IS NOT NULL
                         AND n.tests_num > 0
                         AND n.passes_num IS NOT NULL
                        THEN LEAST(
                            GREATEST(
                                floor((n.passes_num / n.tests_num) * 100)::int,
                                0
                                -- guard against negative % (passes_num > tests_num)
                            ),
                            100
                            -- guard against over-100 % (passes_num > tests_num)
                        )

                        -- Very old runs that never stored a 'passes' key.
                        -- Derive passes by subtracting every known loss counter
                        -- from the total.  LEAST/GREATEST clamps the result to
                        -- [0, 100] in case the historical counters are inconsistent
                        -- (e.g. sum of losses exceeds tests due to data corruption).
                        WHEN n.tests_num IS NOT NULL
                         AND n.tests_num > 0
                         AND n.passes_num IS NULL
                        THEN LEAST(
                            GREATEST(
                                floor(
                                    (
                                        n.tests_num
                                        - n.failures_num
                                        - n.errors_num
                                        - n.skips_num
                                        - n.xpasses_num
                                        - n.xfailures_num
                                    ) / n.tests_num * 100
                                )::int,
                                0
                            ),
                            100
                        )

                        -- tests is 0, absent, or malformed: no meaningful
                        -- percentage can be computed, store 0 as a sentinel.
                        ELSE 0
                    END
                )
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
