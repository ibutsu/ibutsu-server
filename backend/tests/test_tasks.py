"""Tests for ibutsu_server.tasks"""

from unittest.mock import MagicMock, patch

import pytest
from celery import Celery
from redis.exceptions import LockError

from ibutsu_server.tasks import IbutsuTask, create_celery_app, lock


def test_create_celery_app(flask_app):
    """Test creating a Celery app with real Flask app."""
    client, _ = flask_app

    with client.application.app_context():
        celery_app = create_celery_app(client.application)

        assert celery_app is not None
        assert isinstance(celery_app, Celery)


def test_ibutsu_task_after_return(flask_app):
    """Test the after_return method of IbutsuTask."""
    client, _ = flask_app

    task = IbutsuTask()
    task.app = client.application  # Use real app

    # Mock only the session methods to verify they're called
    with (
        client.application.app_context(),
        patch("ibutsu_server.tasks.session.commit") as mock_commit,
        patch("ibutsu_server.tasks.session.remove") as mock_remove,
    ):
        task.after_return("SUCCESS", None, "task_id", [], {}, None)

        mock_commit.assert_called_once()
        mock_remove.assert_called_once()


@patch("logging.info")
def test_ibutsu_task_on_failure(mock_log_info):
    """Test the on_failure method of IbutsuTask."""
    task = IbutsuTask()
    task.on_failure(Exception("Test Error"), "task_id", [], {}, None)
    mock_log_info.assert_called_once()


@patch("ibutsu_server.tasks.Redis.from_url")
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
@patch("ibutsu_server.tasks.Redis.from_url")
def test_lock_locked(mock_redis_from_url, mock_log_info, flask_app):
    """Test that the lock works when it is already locked."""
    client, _ = flask_app

    # Mock only the Redis external service
    mock_redis_client = MagicMock()
    mock_redis_client.lock.side_effect = LockError("Already locked")
    mock_redis_from_url.return_value = mock_redis_client

    with client.application.app_context(), lock("my-lock"):
        # This code should not run
        pytest.fail("Should not have acquired lock")

    mock_log_info.assert_called_with("Task my-lock is already locked, discarding")
