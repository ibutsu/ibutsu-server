from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.tasks import lock
from ibutsu_server.tasks import task


METADATA_TO_COPY = ["jenkins", "tags"]
COLUMNS_TO_COPY = ["start_time", "env", "component", "project_id", "source"]


def _copy_result_metadata(result, metadata, key):
    if not metadata.get(key) and result.data and result.data.get(key):
        metadata[key] = result.data[key]


def _copy_column(result, run, key):
    if not getattr(run, key, None):
        setattr(run, key, getattr(result, key, None))


@task(max_retries=1000)
def update_run(run_id):
    """Update the run summary from the results, this task will retry 1000 times"""
    with lock(f"update-run-lock-{run_id}"):
        run = Run.query.get(run_id)
        if not run:
            return
        # sort according to start_time to get the most recent starting time of the run
        results = (
            Result.query.filter(Result.run_id == run_id).order_by(Result.start_time.asc()).limit(1)
        )
        summary = {
            "errors": run.summary.get("errors", 0),
            "failures": run.summary.get("failures", 0),
            "skips": run.summary.get("skips", 0),
            "tests": run.summary.get("tests", 0),
            "xpasses": run.summary.get("xpasses", 0),
            "xfailures": run.summary.get("xfailures", 0),
            "collected": run.summary.get("collected", 0),
        }
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

        # copy over some metadata from the results
        metadata = run.data or {}
        for result in results:
            for column in COLUMNS_TO_COPY:
                _copy_column(result, run, column)

            for key in METADATA_TO_COPY:
                _copy_result_metadata(result, metadata, key)

        run.update({"summary": summary, "data": metadata})
        session.add(run)
        session.commit()
