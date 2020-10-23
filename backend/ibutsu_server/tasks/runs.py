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
        key_map = {
            "failed": "failures",
            "error": "errors",
            "skipped": "skips",
            "xpassed": "xpasses",
            "xfailed": "xfailures",
        }
        run = Run.query.get(run_id)
        if not run:
            return
        # sort according to starttime to get the most recent starting time of the run
        results = (
            Result.query.filter(Result.run_id == run_id).order_by(Result.start_time.asc()).all()
        )
        summary = {"errors": 0, "failures": 0, "skips": 0, "tests": 0, "xpasses": 0, "xfailures": 0}
        run_duration = 0.0
        metadata = run.data or {}
        for counter, result in enumerate(results):
            if counter == 0:
                for column in COLUMNS_TO_COPY:
                    _copy_column(result, run, column)

            summary["tests"] += 1
            key = key_map.get(result.result, None)
            if key:
                summary[key] += 1
            if result.duration:
                run_duration += result.duration

            for key in METADATA_TO_COPY:
                _copy_result_metadata(result, metadata, key)

        run.update({"summary": summary, "data": metadata})
        if run_duration:
            run.duration = run_duration
        session.add(run)
        session.commit()
