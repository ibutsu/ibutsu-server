import logging

from redis.exceptions import LockError

from ibutsu_server.db import db
from ibutsu_server.db.models import Result, Run
from ibutsu_server.tasks import shared_task
from ibutsu_server.util.redis_lock import is_locked, lock


@shared_task
def add_result_start_time(run_id: str) -> None:
    """Update all results in a run to add the 'start_time' field to a result"""
    # Use the *same* lock key that update_run() uses for this run_id: these two
    # tasks must not run concurrently against the same run, and is_locked()
    # must check the exact key that lock() acquires, or the guard is a no-op.
    lock_name = f"update-run-lock-{run_id}"
    if is_locked(lock_name):
        logging.warning(f"{lock_name}: Already locked, discarding.")
        return

    try:
        with lock(lock_name):
            # Fetch the run INSIDE the lock to ensure we see the most recent
            # committed state and avoid TOCTOU races with the same pattern as
            # update_run(). The pre-lock optimization created a race where
            # db.session.get() could read from a stale session under high load.
            run = db.session.get(Run, run_id)
            if not run:
                return

            results = db.session.execute(
                db.select(Result).where(Result.data["metadata"]["run"] == run_id)
            ).scalars()
            for result in results:
                if not result.data.get("start_time"):
                    result.data["start_time"] = result.data.get("starttime")
                    db.session.add(result)
            db.session.commit()
    except LockError:
        # Lost a race to acquire the lock after the is_locked() check above --
        # another task for this run (add_result_start_time or update_run) is
        # already in progress. Discard rather than let the uncaught exception
        # trigger the global task-failure retry handler.
        logging.warning(f"{lock_name}: Lock acquisition failed, discarding.")
