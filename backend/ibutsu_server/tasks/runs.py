from datetime import UTC, datetime, timedelta

from ibutsu_server.constants import SYNC_RUN_TIME
from ibutsu_server.db import db
from ibutsu_server.db.models import Result, Run
from ibutsu_server.tasks import shared_task
from ibutsu_server.util.redis_lock import lock

METADATA_TO_COPY = ["jenkins", "tags"]
COLUMNS_TO_COPY = ["start_time", "env", "component", "project_id", "source"]


def _copy_result_metadata(result, metadata, key):
    if not metadata.get(key) and result.data and result.data.get(key):
        metadata[key] = result.data[key]


def _copy_column(result, run, key):
    if not getattr(run, key, None):
        setattr(run, key, getattr(result, key, None))


def _status_to_summary(status):
    return {
        "failed": "failures",
        "error": "errors",
        "skipped": "skips",
        "xfailed": "xfailures",
        "xpassed": "xpasses",
        "tests": "tests",
    }.get(status, status)


@shared_task(max_retries=1000)
def update_run(run_id):
    """Update the run summary from the results, this task will retry 1000 times"""
    with lock(f"update-run-lock-{run_id}"):
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
                db.select(Result).where(Result.run_id == run_id).order_by(Result.start_time.asc())
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
        # determine the number of tests that didn't run
        summary["not_run"] = max(summary["collected"] - summary["tests"], 0)

        run.update({"summary": summary, "data": metadata})
        db.session.add(run)
        db.session.commit()


@shared_task(max_retries=1)
def sync_aborted_runs():
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
