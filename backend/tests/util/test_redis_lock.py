"""Tests for ibutsu_server.util.redis_lock module"""

from unittest.mock import MagicMock, patch

import pytest
from redis.exceptions import LockError

from ibutsu_server.constants import LOCK_EXPIRE, LOCK_TTL
from ibutsu_server.util.redis_lock import is_locked, lock


def _mock_redis_client(acquire_return=True):
    """Build a mock Redis client whose .lock().acquire() returns the given value."""
    mock_redis_lock = MagicMock()
    mock_redis_lock.acquire.return_value = acquire_return
    mock_client = MagicMock()
    mock_client.lock.return_value = mock_redis_lock
    return mock_client, mock_redis_lock


def test_lock_yields_once_on_success():
    """When the lock is acquired, the context manager should yield exactly once
    and release the lock on exit."""
    mock_client, mock_redis_lock = _mock_redis_client(acquire_return=True)

    with patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client):
        entered = False
        with lock("some-lock"):
            entered = True

    assert entered
    mock_redis_lock.acquire.assert_called_once_with(blocking=True)
    mock_redis_lock.release.assert_called_once()


def test_lock_sets_ttl_and_blocking_timeout():
    """The underlying Redis lock must get a real expiry (LOCK_TTL) distinct from
    the acquire-wait timeout (blocking_timeout), so a crashed holder can't leave
    the lock stuck forever."""
    mock_client, _ = _mock_redis_client(acquire_return=True)

    with (
        patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client),
        lock("some-lock", timeout=7),
    ):
        pass

    mock_client.lock.assert_called_once_with("some-lock", timeout=LOCK_TTL, blocking_timeout=7)


def test_lock_uses_default_timeout():
    mock_client, _ = _mock_redis_client(acquire_return=True)

    with (
        patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client),
        lock("some-lock"),
    ):
        pass

    mock_client.lock.assert_called_once_with(
        "some-lock", timeout=LOCK_TTL, blocking_timeout=LOCK_EXPIRE
    )


def test_lock_raises_lock_error_when_busy_without_crashing():
    """When the lock can't be acquired, lock() must raise a clean LockError
    instead of returning without yielding (which contextlib would otherwise
    surface as RuntimeError: generator didn't yield)."""
    mock_client, mock_redis_lock = _mock_redis_client(acquire_return=False)

    def _enter_lock():
        with lock("some-lock"):
            pytest.fail("lock body should never execute when the lock isn't acquired")

    with (
        patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client),
        pytest.raises(LockError),
    ):
        _enter_lock()

    # Never acquired, so release should never be attempted.
    mock_redis_lock.release.assert_not_called()


def test_lock_releases_even_if_body_raises():
    """The lock must still be released if the wrapped code raises."""
    mock_client, mock_redis_lock = _mock_redis_client(acquire_return=True)

    def _raise_inside_lock():
        with lock("some-lock"):
            msg = "boom"
            raise ValueError(msg)

    with (
        patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client),
        pytest.raises(ValueError, match="boom"),
    ):
        _raise_inside_lock()

    mock_redis_lock.release.assert_called_once()


def test_lock_release_lock_error_is_swallowed():
    """If the lock already expired (LOCK_TTL) or was released elsewhere by the
    time we try to release it, that LockError on release must not propagate."""
    mock_client, mock_redis_lock = _mock_redis_client(acquire_return=True)
    mock_redis_lock.release.side_effect = LockError("already unlocked")

    with (
        patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client),
        lock("some-lock"),
    ):
        pass  # should not raise on exit despite release() failing


def test_is_locked_checks_key_existence():
    mock_client = MagicMock()
    mock_client.exists.return_value = 1

    with patch("ibutsu_server.util.redis_lock.get_redis_client", return_value=mock_client):
        assert is_locked("some-lock")

    mock_client.exists.assert_called_once_with("some-lock")
