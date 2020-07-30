import time
from datetime import datetime

from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.db.base import session
from ibutsu_server.tasks import task, lock
from ibutsu_server.util.json import jsonify


METADATA_TO_COPY = ["component", "env", "project", "jenkins", "tags"]


def _copy_result_metadata(result, metadata, key):
    if not metadata.get(key) and result.get("metadata") and result["metadata"].get(key):
        metadata[key] = result["metadata"][key]


@task
def update_run(run_id):
    """Update the run summary from the results"""
    with lock(f"update-run-lock-{run_id}"):
        key_map = {"failed": "failures", "error": "errors", "skipped": "skips"}
        run = Run.query.get(run_id)
        if not run:
            return
        # sort according to starttime to get the most recent starting time of the run
        results = (
            Result.query
            .filter(Result.data["metadata"]["run"] == jsonify(run_id))
            .order_by(Result.data["start_time"].asc()).all()
        )
        summary = {"errors": 0, "failures": 0, "skips": 0, "tests": 0}
        run_duration = 0.0
        metadata = run.get("metadata") or {}
        for counter, result in enumerate(results):
            if counter == 0:
                if not run.get("start_time"):
                    run.data["start_time"] = result.get("start_time", result.get("starttime"))
                if not run.get("created"):
                    run.data["created"] = datetime.fromtimestamp(
                        run.get("start_time") or time.time()
                    ).isoformat()
            summary["tests"] += 1
            key = key_map.get(result["result"], None)
            if key:
                summary[key] += 1
            if result.get("duration"):
                run_duration += result["duration"]
            if not run.get("source") and result.get("source"):
                run.data["source"] = result["source"]
            for key in METADATA_TO_COPY:
                _copy_result_metadata(result, metadata, key)
        run.update({
            "summary": summary,
            "metadata": metadata
        })
        if run_duration:
            run.data["duration"] = run_duration
        session.add(run)
        session.commit()
