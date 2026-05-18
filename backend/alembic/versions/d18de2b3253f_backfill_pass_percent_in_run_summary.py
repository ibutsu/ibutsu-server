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


def _ensure_index(name: str, table: str, columns, *, create: bool, **kwargs) -> None:
    """Idempotent index create/drop for PostgreSQL-specific indexes."""
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    exists = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE indexname = :index_name
                  AND tablename = :table_name
            )
            """
        ),
        {"index_name": name, "table_name": table},
    ).scalar()

    if create and not exists:
        op.create_index(name, table, columns, **kwargs)
    elif not create and exists:
        op.drop_index(name, table_name=table)


def upgrade() -> None:
    logger.info("Starting migration d18de2b3253f: backfill pass_percent")

    conn = op.get_bind()

    if conn.dialect.name != "postgresql":
        logger.info("Non-PostgreSQL dialect; skipping pass_percent backfill")
        return

    result = conn.execute(
        sa.text(
            """
            UPDATE runs
            SET summary = jsonb_set(
                COALESCE(summary, '{}'::jsonb),
                '{pass_percent}',
                to_jsonb(
                    CASE
                        -- passes key present: compute directly from passes/tests
                        WHEN summary IS NOT NULL
                         AND summary->>'tests' ~ '^[0-9]+$'
                         AND (summary->>'tests')::int > 0
                         AND summary->>'passes' ~ '^[0-9]+$'
                        THEN floor(
                            ((summary->>'passes')::numeric
                             / (summary->>'tests')::numeric) * 100
                        )::int

                        -- no passes key (very old runs): derive from counters
                        WHEN summary IS NOT NULL
                         AND summary->>'tests' ~ '^[0-9]+$'
                         AND (summary->>'tests')::int > 0
                         AND summary->>'passes' IS NULL
                        THEN floor(
                            (
                                (summary->>'tests')::numeric
                                - CASE WHEN summary->>'failures' ~ '^[0-9]+$'
                                       THEN (summary->>'failures')::numeric ELSE 0 END
                                - CASE WHEN summary->>'errors' ~ '^[0-9]+$'
                                       THEN (summary->>'errors')::numeric ELSE 0 END
                                - CASE WHEN summary->>'skips' ~ '^[0-9]+$'
                                       THEN (summary->>'skips')::numeric ELSE 0 END
                                - CASE WHEN summary->>'xpasses' ~ '^[0-9]+$'
                                       THEN (summary->>'xpasses')::numeric ELSE 0 END
                                - CASE WHEN summary->>'xfailures' ~ '^[0-9]+$'
                                       THEN (summary->>'xfailures')::numeric ELSE 0 END
                            ) / (summary->>'tests')::numeric * 100
                        )::int

                        -- zero tests, missing tests key, or malformed values: store 0
                        ELSE 0
                    END
                )
            )
            WHERE summary IS NOT NULL
              AND summary->'pass_percent' IS NULL
            """
        )
    )
    logger.info("Backfilled pass_percent for %d runs", result.rowcount)

    _ensure_index(
        "ix_runs_pass_percent",
        "runs",
        [sa.text("((summary->>'pass_percent')::int)")],
        create=True,
        unique=False,
    )
    logger.info("Created ix_runs_pass_percent index")


def downgrade() -> None:
    _ensure_index("ix_runs_pass_percent", "runs", None, create=False)
