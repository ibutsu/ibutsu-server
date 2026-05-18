"""backfill_pass_percent_in_run_summary

Backfill pass_percent into the summary JSON blob for all existing runs,
and create a B-tree expression index for fast range filtering.

PostgreSQL only -- skipped on SQLite (dev/test environments).

Revision ID: d18de2b3253f
Revises: e5736dbcc0b0
Create Date: 2026-05-18 19:30:00.000000

"""

import logging
import time

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision = "d18de2b3253f"
down_revision = "e5736dbcc0b0"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.versions.d18de2b3253f")

BATCH_SIZE = 5000

# Fail fast on lock waits instead of hanging the container until it is killed.
# 30s is enough to prove contention; production backfills that take longer per
# batch should raise this via ALTER ... SET lock_timeout if needed.
_LOCK_TIMEOUT = "30s"

# Canonical pass_percent formula: floor(passes * 100 / tests), clamped to
# [0, 100].  This matches ibutsu_server.tasks.runs.compute_pass_percent
# (used by update_run) and the frontend fallback in
# frontend/src/utilities/run.js (getRunPassPercent). This SQL can't call
# into either of those directly, so if the formula changes, update all
# three -- see test_runs.py::test_compute_pass_percent_* for the cases
# that must match across implementations.
#
# Non-passing outcomes subtracted when deriving passes (old runs that lack an
# explicit "passes" key): failures, errors, skips, xpasses, xfailures.
# If this list changes, update compute_pass_percent and getRunPassPercent
# as well.
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

_PENDING_COUNT_SQL = sa.text("""\
SELECT COUNT(*) FROM runs
WHERE summary IS NOT NULL
  AND summary->'pass_percent' IS NULL
""")

_BACKEND_PID_SQL = sa.text("SELECT pg_backend_pid()")

_LOCK_DIAG_SQL = sa.text("""\
SELECT
    a.pid,
    a.state,
    a.wait_event_type,
    a.wait_event,
    a.query_start,
    LEFT(a.query, 120) AS query,
    l.locktype,
    l.mode,
    l.granted,
    l.relation::regclass AS relation
FROM pg_stat_activity AS a
LEFT JOIN pg_locks AS l ON l.pid = a.pid
WHERE a.datname = current_database()
  AND a.pid <> pg_backend_pid()
  AND (
    NOT COALESCE(l.granted, true)
    OR a.wait_event_type IS NOT NULL
    OR a.state <> 'idle'
  )
ORDER BY a.query_start NULLS LAST
LIMIT 40
""")


def _log(msg: str, *args: object) -> None:
    logger.info(msg, *args)


def _flush_logs() -> None:
    """Flush handlers so container logs show progress before a hang/kill.

    Called at coarse-grained points (batch/step boundaries, and on error)
    rather than after every _log() call, since flushing on every message is
    needless overhead for a migration that may log hundreds of batches.
    """
    for handler in logging.root.handlers:
        handler.flush()
    for handler in logger.handlers:
        handler.flush()


def _dump_lock_diagnostics(conn: sa.Connection, reason: str) -> None:
    """Emit pg_stat_activity / pg_locks snapshot to explain a lock wait."""
    _log("Lock diagnostic dump (%s):", reason)
    try:
        rows = conn.execute(_LOCK_DIAG_SQL).mappings().all()
    except Exception as exc:
        _log("  failed to query lock diagnostics: %s", exc)
        _flush_logs()
        return
    if not rows:
        _log("  (no blocking/waiting activity found)")
    for row in rows:
        _log(
            "  pid=%s state=%s wait=%s/%s granted=%s mode=%s rel=%s query=%r",
            row["pid"],
            row["state"],
            row["wait_event_type"],
            row["wait_event"],
            row["granted"],
            row["mode"],
            row["relation"],
            row["query"],
        )
    _flush_logs()


def _run_backfill_batches(conn: sa.Connection) -> int:
    """Repeatedly apply _BACKFILL_BATCH_SQL until fewer than BATCH_SIZE rows remain.

    Returns the total number of rows updated across all batches.
    """
    total_updated = 0
    batch_num = 0
    while True:
        batch_num += 1
        started = time.monotonic()
        _log("Executing backfill batch %d ...", batch_num)
        _flush_logs()
        try:
            result = conn.execute(_BACKFILL_BATCH_SQL, {"batch_size": BATCH_SIZE})
        except Exception:
            _dump_lock_diagnostics(conn, f"batch {batch_num} failed")
            raise
        batch_count = result.rowcount if result.rowcount is not None else -1
        # Treat unknown rowcount as "keep going only if we know we updated"
        # — for PostgreSQL UPDATE, rowcount is reliable.
        if batch_count < 0:
            _log("Batch %d returned unknown rowcount; treating as complete", batch_num)
            break
        total_updated += batch_count
        elapsed = time.monotonic() - started
        _log(
            "  batch %d: %d rows updated in %.2fs (total=%d)",
            batch_num,
            batch_count,
            elapsed,
            total_updated,
        )
        if batch_count < BATCH_SIZE:
            break

    return total_updated


def _create_pass_percent_index(conn: sa.Connection) -> None:
    """Create the ix_runs_pass_percent expression index outside a transaction."""
    _log("Creating ix_runs_pass_percent CONCURRENTLY ...")
    _flush_logs()
    idx_started = time.monotonic()
    try:
        conn.execute(
            sa.text(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_runs_pass_percent "
                "ON runs (((summary->>'pass_percent')::int))"
            )
        )
    except Exception:
        _dump_lock_diagnostics(conn, "CREATE INDEX CONCURRENTLY failed")
        raise
    _log(
        "Created ix_runs_pass_percent index (CONCURRENTLY) in %.2fs",
        time.monotonic() - idx_started,
    )
    _flush_logs()


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
        _log("Non-PostgreSQL dialect; skipping pass_percent backfill")
        return

    _log("Starting migration d18de2b3253f: backfill pass_percent")
    _flush_logs()

    # IMPORTANT: Do NOT open a second engine.connect() while Alembic still holds
    # its migration transaction. Prior DDL (e.g. CREATE INDEX on runs) keeps
    # ShareLocks until that transaction commits; a second connection's UPDATE
    # then waits forever (self-deadlock). Use autocommit_block so Alembic
    # commits first, then each batch / CONCURRENTLY index runs outside a txn.
    with op.get_context().autocommit_block():
        conn = op.get_bind()
        backend_pid = conn.execute(_BACKEND_PID_SQL).scalar()
        pending = conn.execute(_PENDING_COUNT_SQL).scalar() or 0
        _log(
            "Autocommit block active (pg_backend_pid=%s); pending runs=%d; batch_size=%d",
            backend_pid,
            pending,
            BATCH_SIZE,
        )

        # PostgreSQL's SET does not reliably accept bind parameters for its
        # value, so _LOCK_TIMEOUT (a trusted internal constant, not user
        # input) is interpolated directly to keep the log message and the
        # effective timeout in sync.
        conn.execute(sa.text(f"SET lock_timeout = '{_LOCK_TIMEOUT}'"))
        _log("Set lock_timeout=%s for backfill connection", _LOCK_TIMEOUT)
        _flush_logs()

        total_updated = _run_backfill_batches(conn)
        _log("Backfilled pass_percent for %d runs total", total_updated)
        _flush_logs()

        _create_pass_percent_index(conn)


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
