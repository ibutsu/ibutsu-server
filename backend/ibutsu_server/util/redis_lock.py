import logging
from contextlib import contextmanager

from redis import Redis
from redis.exceptions import LockError

from ibutsu_server.constants import LOCK_EXPIRE, SOCKET_CONNECT_TIMEOUT, SOCKET_TIMEOUT


def get_redis_client(app=None):
    if not app:
        from ibutsu_server.util.celery_task import get_flask_app

        app = get_flask_app()

    redis_client = Redis.from_url(
        app.config["CELERY_BROKER_URL"],
        socket_timeout=SOCKET_TIMEOUT,
        socket_connect_timeout=SOCKET_CONNECT_TIMEOUT,
    )
    return redis_client


def is_locked(name, app=None):
    redis_client = get_redis_client(app=app)
    return redis_client.exists(name)


@contextmanager
def lock(name, timeout=LOCK_EXPIRE, app=None):
    redis_client = get_redis_client(app=app)

    try:
        # Get a lock so that we don't run this task concurrently
        logging.info(f"Trying to get a lock for {name}")
        with redis_client.lock(name, blocking_timeout=timeout):
            yield
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        logging.info(f"Task {name} is already locked, discarding")
