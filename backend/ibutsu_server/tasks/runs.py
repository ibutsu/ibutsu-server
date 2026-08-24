import logging
from datetime import UTC, datetime, timedelta

from redis.exceptions import LockError

from ibutsu_server.constants import SYNC_RUN_TIME
from ibutsu_server.db import db
from ibutsu_server.db.models import Result, Run
from ibutsu_server.tasks import shared_task
from ibutsu_server.util.redis_lock import is_locked, lock

METADATA_TO_COPY = ["jenkins", "tags"]
COLUMNS_TO_COPY = ["start_time", "env", "component", "project_id", "source"]


def _copy_result_metadata(result: Result, metadata: dict, key: str) -> None:
    if not metadata.get(key) and result.data and result.data.get(key):
        metadata[key] = result.data[key]


def _copy_column(result: Result, run: Run, key: str) -> None:
    if not getattr(run, key, None):
        setattr(run, key, getattr(result, key, None))


def _status_to_summary(status: str) -> str:
    return {
        "failed": "failures",
        "error": "errors",
        "skipped": "skips",
        "xfailed": "xfailures",
        "xpassed": "xpasses",
        "tests": "tests",
    }.get(status, status)


def compute_pass_percent(passes: int, tests: int) -> int:
    """Canonical pass_percent formula, shared by ``update_run`` below.

    floor(passes * 100 / tests), clamped to [0, 100]. Integer arithmetic
    avoids float rounding; the result is floored and clamped to guard
    against inconsistent/malformed inputs (e.g. passes > tests, or a
    negative derived pass count).

    This formula is also replicated in the migration backfill SQL
    (d18de2b3253f_backfill_pass_percent_in_run_summary.py) and the frontend
    fallback (getRunPassPercent in frontend/src/utilities/run.js), since
    those run outside this Python process. Keep all three in sync -- see
    test_runs.py::test_compute_pass_percent_* for the cases that must match
    across implementations.
    """
    if tests <= 0:
        return 0
    return max(min((passes * 100) // tests, 100), 0)


@shared_task(max_retries=1000)
def update_run(run_id: str) -> None:
    """Update the run summary from the results, this task will retry 1000 times"""
    lock_name = f"update-run-lock-{run_id}"
    if is_locked(lock_name):
        logging.warning(f"{lock_name}: Already locked, discarding.")
        return

    try:
        with lock(lock_name):
            # Fetch the run INSIDE the lock to ensure we see the most recent
            # committed state and avoid TOCTOU races. The pre-lock optimization
            # of checking run existence before acquiring the lock created a race
            # where db.session.get() could read from a stale session under high
            # load, causing update_run to exit early for runs that actually exist,
            # leading to missing metadata and cascading database issues.
            run = db.session.get(Run, run_id)
            if not run:
                return

            # initialize some necessary variables
            summary = {
                "errors": 0,
                "failures": 0,
                "skips": 0,
                "tests": 0,
                "xpasses": 0,
                "xfailures": 0,
                "collected": run.summary.get("collected", 0) if run.summary else 0,
            }
            run.duration = 0.0
            metadata = run.data or {}

            # Fetch all the results for the runs and calculate the summary
            results = (
                db.session.execute(
                    db.select(Result)
                    .where(Result.run_id == run_id)
                    .order_by(Result.start_time.asc())
                )
                .scalars()
                .all()
            )

            for i, result in enumerate(results):
                if i == 0:
                    # on the first result, copy over some metadata
                    for column in COLUMNS_TO_COPY:
                        _copy_column(result, run, column)

                    for key in METADATA_TO_COPY:
                        _copy_result_metadata(result, metadata, key)

                key = _status_to_summary(result.result)
                if key in summary:
                    summary[key] = summary.get(key, 0) + 1
                # update the number of tests that actually ran
                summary["tests"] += 1
                if result.duration:
                    run.duration += result.duration

            # determine the number of passes
            summary["passes"] = summary["tests"] - (
                summary["errors"]
                + summary["xpasses"]
                + summary["xfailures"]
                + summary["failures"]
                + summary["skips"]
            )
            summary["pass_percent"] = compute_pass_percent(summary["passes"], summary["tests"])
            # determine the number of tests that didn't run
            summary["not_run"] = max(summary["collected"] - summary["tests"], 0)

            run.update({"summary": summary, "data": metadata})
            db.session.add(run)
            db.session.commit()
    except LockError:
        # Lost a race to acquire the lock after the is_locked() check above --
        # another update_run for this run is already in progress. Discard rather
        # than let the uncaught exception trigger the global task-failure retry.
        logging.warning(f"{lock_name}: Lock acquisition failed, discarding.")


@shared_task(max_retries=1)
def sync_aborted_runs() -> None:
    """
    When test runs are prematurely aborted, e.g. due to a connection failure or outage, the number
    of tests that are stored in summary.tests on a Run will not match the number of results for that
    Run in the database.

    This periodic task will search through recent runs and compare 'summary.tests' to the actual
    number of results. If there is a mismatch, it will run the 'update_run' task on the Run.id.
    """
    # fetch recent runs
    runs = db.session.execute(
        db.select(Run).where(
            Run.start_time > (datetime.now(UTC) - timedelta(seconds=SYNC_RUN_TIME))
        )
    ).scalars()

    # for each run, check if the result count matches 'summary.tests'
    # if it doesn't, run the update_run task
    for run in runs:
        result_count = (
            db.session.execute(
                db.select(db.func.count()).select_from(
                    db.select(Result).where(Result.run_id == run.id).subquery()
                )
            ).scalar()
            or 0
        )

        # Handle runs with None or incomplete summary
        summary_tests = run.summary.get("tests", 0) if run.summary else 0
        if summary_tests != result_count:
            update_run.apply_async((run.id,), countdown=5)
