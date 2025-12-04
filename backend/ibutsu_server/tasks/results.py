import logging

from ibutsu_server.db import db
from ibutsu_server.db.models import Result, Run
from ibutsu_server.tasks import shared_task
from ibutsu_server.util.redis_lock import is_locked, lock


@shared_task
def add_result_start_time(run_id):
    """Update all results in a run to add the 'start_time' field to a result"""
    if is_locked(run_id):
        logging.warning(f"{run_id}: Already locked.")
        return

    with lock(f"update-run-lock-{run_id}"):
        run = db.session.get(Run, run_id)
        if not run:
            return
        results = db.session.execute(
            db.select(Result).where(Result.data["metadata"]["run"] == run_id)
        ).scalars()
        for result in results:
            if not result.get("start_time"):
                result.data["start_time"] = result.get("starttime")
                db.session.add(result)
        db.session.commit()
