"""Tests for ibutsu_server.tasks"""

from unittest.mock import MagicMock, patch

import pytest
from celery import Celery
from flask import Flask
from redis.exceptions import LockError

from ibutsu_server.tasks import IbutsuTask, create_celery_app, lock


@pytest.fixture
def mock_flask_app():
    """Fixture for a mock Flask app."""
    app = Flask("test_app")
    app.config.update(
        {
            "CELERY_BROKER_URL": "redis://localhost:6379/0",
            "CELERY_RESULT_BACKEND": "redis://localhost:6379/0",
            "SQLALCHEMY_COMMIT_ON_TEARDOWN": True,
        }
    )
    return app


def test_create_celery_app(mock_flask_app):
    """Test creating a Celery app."""
    with patch("ibutsu_server.tasks.Celery") as mocked_celery:
        app_instance = MagicMock(spec=Celery)
        mocked_celery.return_value = app_instance

        celery_app = create_celery_app(mock_flask_app)

        assert celery_app is not None
        mocked_celery.assert_called_once()


@patch("ibutsu_server.tasks.session")
def test_ibutsu_task_after_return(mock_session, mock_flask_app):
    """Test the after_return method of IbutsuTask."""
    task = IbutsuTask()
    task.app = mock_flask_app  # Simulate app binding

    with mock_flask_app.app_context():
        task.after_return("SUCCESS", None, "task_id", [], {}, None)

    mock_session.commit.assert_called_once()
    mock_session.remove.assert_called_once()


@patch("logging.info")
def test_ibutsu_task_on_failure(mock_log_info):
    """Test the on_failure method of IbutsuTask."""
    task = IbutsuTask()
    task.on_failure(Exception("Test Error"), "task_id", [], {}, None)
    mock_log_info.assert_called_once()


@patch("ibutsu_server.tasks.Redis.from_url")
def test_lock_successful(mock_redis_from_url):
    """Test that the lock works when it is acquired."""
    mock_redis_client = MagicMock()
    mock_lock = MagicMock()
    mock_redis_client.lock.return_value.__enter__.return_value = mock_lock
    mock_redis_from_url.return_value = mock_redis_client

    with lock("my-lock"):
        # This code should run
        pass

    mock_redis_client.lock.assert_called_once_with("my-lock", blocking_timeout=1)


@patch("logging.info")
@patch("ibutsu_server.tasks.Redis.from_url")
def test_lock_locked(mock_redis_from_url, mock_log_info):
    """Test that the lock works when it is already locked."""
    mock_redis_client = MagicMock()
    mock_redis_client.lock.side_effect = LockError("Already locked")
    mock_redis_from_url.return_value = mock_redis_client

    with lock("my-lock"):
        # This code should not run
        pytest.fail("Should not have acquired lock")

    mock_log_info.assert_called_with("Task my-lock is already locked, discarding")
