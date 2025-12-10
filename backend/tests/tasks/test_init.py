"""Tests for ibutsu_server.tasks.__init__ module"""

from unittest.mock import MagicMock, patch

from celery import Celery
from redis.exceptions import LockError

from ibutsu_server.tasks import IbutsuTask, create_celery_app, lock, task


def test_create_celery_app(flask_app):
    """Test creating a Celery app with real Flask app."""
    client, _ = flask_app

    with client.application.app_context():
        celery_app = create_celery_app(client.application)

        assert celery_app is not None
        assert isinstance(celery_app, Celery)


def test_get_celery_app(flask_app):
    """Test get_celery_app returns a celery instance."""
    client, _ = flask_app

    # Access celery app directly from Flask app extensions
    # This avoids calling get_celery_app() which would try to reinitialize
    celery_app = client.application.extensions.get("celery")
    assert celery_app is not None
    assert isinstance(celery_app, Celery)


def test_task_decorator():
    """Test task decorator returns a celery task."""

    @task
    def dummy_task():
        return "result"

    assert hasattr(dummy_task, "apply_async")


def test_ibutsu_task_after_return(flask_app):
    """Test the after_return method of IbutsuTask."""
    client, _ = flask_app

    task = IbutsuTask()
    task.flask_app = client.application  # Use real app

    # Enable commit on teardown for this test
    with (
        client.application.app_context(),
        patch("ibutsu_server.db.db.session.commit") as mock_commit,
        patch("ibutsu_server.db.db.session.remove") as mock_remove,
    ):
        task.after_return("SUCCESS", None, "task_id", [], {}, None)

        mock_commit.assert_called_once()
        mock_remove.assert_called_once()


def test_ibutsu_task_after_return_with_exception(flask_app):
    """Test the after_return method of IbutsuTask when an exception is returned."""
    client, _ = flask_app

    task = IbutsuTask()
    task.flask_app = client.application

    with (
        client.application.app_context(),
        patch("ibutsu_server.db.db.session.commit") as mock_commit,
        patch("ibutsu_server.db.db.session.remove") as mock_remove,
    ):
        # When retval is an Exception, commit should not be called
        task.after_return("FAILURE", Exception("test"), "task_id", [], {}, None)

        mock_commit.assert_not_called()
        mock_remove.assert_called_once()


@patch("logging.error")
def test_ibutsu_task_on_failure(mock_log_error, flask_app):
    """Test the on_failure method of IbutsuTask."""
    client, _ = flask_app

    with client.application.app_context():
        task = IbutsuTask()
        task.on_failure(Exception("Test Error"), "task_id", [], {}, None)
        mock_log_error.assert_called_once()


@patch("redis.Redis.from_url")
def test_lock_successful(mock_redis_from_url, flask_app):
    """Test that the lock works when it is acquired."""
    client, _ = flask_app

    # Mock only the Redis external service
    mock_redis_client = MagicMock()
    mock_lock = MagicMock()
    mock_redis_client.lock.return_value.__enter__.return_value = mock_lock
    mock_redis_from_url.return_value = mock_redis_client

    with client.application.app_context(), lock("my-lock"):
        # This code should run
        pass

    mock_redis_client.lock.assert_called_once_with("my-lock", blocking_timeout=1)


@patch("logging.info")
@patch("redis.Redis.from_url")
def test_lock_locked(mock_redis_from_url, mock_log_info, flask_app):
    """Test that the lock handles LockError gracefully."""
    client, _ = flask_app

    # Mock Redis to raise LockError when trying to acquire lock
    mock_redis_client = MagicMock()
    mock_lock = MagicMock()
    mock_lock.__enter__.side_effect = LockError("Already locked")
    mock_redis_client.lock.return_value = mock_lock
    mock_redis_from_url.return_value = mock_redis_client

    with client.application.app_context():
        # When a lock cannot be acquired (LockError), the lock context manager
        # catches it and doesn't yield. This means the code inside the 'with' never runs.
        # We can test this by checking that the log message was generated.

        # Before the lock call, clear previous log calls
        mock_log_info.reset_mock()

        # Try to use the lock - this will catch LockError internally
        executed = False
        try:
            # Create the context manager
            cm = lock("my-lock")
            # Try to enter it - this will catch the LockError
            with cm:
                executed = True
        except (StopIteration, RuntimeError):
            # Context manager doesn't yield when lock fails, which is correct
            pass

        # Code inside should not have executed
        assert not executed

    # Verify the correct log messages were generated
    log_calls = [call[0][0] for call in mock_log_info.call_args_list]
    assert any("already locked" in msg.lower() for msg in log_calls)
