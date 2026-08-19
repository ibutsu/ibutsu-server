import logging
from collections.abc import Iterator
from contextlib import contextmanager, suppress

from flask import Flask
from redis import Redis
from redis.exceptions import LockError

from ibutsu_server.constants import (
    LOCK_EXPIRE,
    LOCK_TTL,
    SOCKET_CONNECT_TIMEOUT,
    SOCKET_TIMEOUT,
)


def get_redis_client(app: Flask | None = None) -> Redis:
    if not app:
        from ibutsu_server.util.celery_task import get_flask_app  # noqa: PLC0415

        app = get_flask_app()

    return Redis.from_url(
        app.config["CELERY_BROKER_URL"],
        socket_timeout=SOCKET_TIMEOUT,
        socket_connect_timeout=SOCKET_CONNECT_TIMEOUT,
    )


def is_locked(name: str, app: Flask | None = None) -> bool:
    redis_client = get_redis_client(app=app)
    return bool(redis_client.exists(name))


@contextmanager
def lock(name: str, timeout: float = LOCK_EXPIRE, app: Flask | None = None) -> Iterator[None]:
    """Acquire a distributed Redis lock for the duration of the ``with`` block.

    ``timeout`` bounds how long to wait to *acquire* the lock (blocking_timeout).
    The lock itself is created with a TTL (``LOCK_TTL``) so that if the holder
    dies (e.g. a worker crash/OOM) before releasing it, the lock self-expires
    instead of being held forever.

    Raises ``redis.exceptions.LockError`` if the lock can't be acquired within
    ``timeout`` seconds, rather than swallowing it here. A generator-based
    context manager must yield at least once for ``__enter__`` to succeed;
    catching ``LockError`` and falling through without yielding previously
    made this function return early, which contextlib surfaces as a confusing
    ``RuntimeError: generator didn't yield`` instead of the real cause.
    Callers that want to discard the work when the lock is busy should check
    ``is_locked()`` first and/or catch ``LockError`` around their
    ``with lock(...):`` block.
    """
    redis_client = get_redis_client(app=app)
    redis_lock = redis_client.lock(name, timeout=LOCK_TTL, blocking_timeout=timeout)

    logging.info(f"Trying to get a lock for {name}")
    if not redis_lock.acquire(blocking=True):
        # Acquisition can fail for reasons other than another worker holding
        # the lock (e.g. Redis connectivity issues), so don't claim it's
        # necessarily "already locked" -- just that we couldn't get it in time.
        logging.warning(
            "Failed to acquire lock for %s within %ss; this may be due to lock "
            "contention or Redis availability issues; discarding task",
            name,
            timeout,
        )
        msg = f"Unable to acquire lock for {name} within {timeout}s"
        raise LockError(msg)

    try:
        yield
    finally:
        # Already released, or expired via LOCK_TTL out from under us; nothing to do.
        with suppress(LockError):
            redis_lock.release()
