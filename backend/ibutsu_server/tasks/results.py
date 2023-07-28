import logging

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.tasks import lock
from ibutsu_server.tasks import task
from redis.exceptions import LockError


@task
def add_result_start_time(run_id):
    """Update all results in a run to add the 'start_time' field to a result"""
    task_name = f"update-run-lock-{run_id}"
    try:
        with lock(task_name):
            run = Run.query.get(run_id)
            if not run:
                return
            results = Result.query.filter(Result.data["metadata"]["run"] == run_id).all()
            for result in results:
                if not result.get("start_time"):
                    result.data["start_time"] = result.get("starttime")
                    session.add(result)
            session.commit()
    except LockError:
        logging.warning(f"Task {task_name} is already locked, discarding")
