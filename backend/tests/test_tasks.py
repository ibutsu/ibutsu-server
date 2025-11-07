"""Tests for ibutsu_server.tasks"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from celery import Celery
from redis.exceptions import LockError

from ibutsu_server.tasks import IbutsuTask, create_celery_app, get_celery_app, lock, task
from ibutsu_server.tasks.db import (
    prune_old_files,
    prune_old_imports,
    prune_old_results,
    prune_old_runs,
)
from ibutsu_server.tasks.query import query_task
from ibutsu_server.tasks.runs import sync_aborted_runs, update_run


def test_create_celery_app(flask_app):
    """Test creating a Celery app with real Flask app."""
    client, _ = flask_app

    with client.application.app_context():
        celery_app = create_celery_app(client.application)

        assert celery_app is not None
        assert isinstance(celery_app, Celery)


def test_get_celery_app():
    """Test get_celery_app returns a celery instance."""
    app = get_celery_app()
    assert app is not None
    assert isinstance(app, Celery)


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
    with client.application.app_context():
        client.application.config["SQLALCHEMY_COMMIT_ON_TEARDOWN"] = True

        # Mock only the session methods to verify they're called
        with (
            patch("ibutsu_server.tasks.session.commit") as mock_commit,
            patch("ibutsu_server.tasks.session.remove") as mock_remove,
        ):
            task.after_return("SUCCESS", None, "task_id", [], {}, None)

            mock_commit.assert_called_once()
            mock_remove.assert_called_once()


def test_ibutsu_task_after_return_with_exception(flask_app):
    """Test the after_return method of IbutsuTask when an exception is returned."""
    client, _ = flask_app

    task = IbutsuTask()
    task.flask_app = client.application

    with client.application.app_context():
        client.application.config["SQLALCHEMY_COMMIT_ON_TEARDOWN"] = True

        with (
            patch("ibutsu_server.tasks.session.commit") as mock_commit,
            patch("ibutsu_server.tasks.session.remove") as mock_remove,
        ):
            # When retval is an Exception, commit should not be called
            task.after_return("FAILURE", Exception("test"), "task_id", [], {}, None)

            mock_commit.assert_not_called()
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


# Tests for tasks.db module


def test_prune_old_files(make_artifact, flask_app):
    """Test prune_old_files deletes old artifacts."""
    client, _ = flask_app

    with client.application.app_context():
        # Create old artifact (older than 5 months)
        old_date = datetime.now(timezone.utc) - timedelta(days=180)
        old_artifact = make_artifact(upload_date=old_date)
        old_artifact_id = old_artifact.id

        # Create recent artifact
        recent_date = datetime.now(timezone.utc) - timedelta(days=30)
        recent_artifact = make_artifact(upload_date=recent_date)
        recent_artifact_id = recent_artifact.id

        # Run the task
        prune_old_files(months=5)

        # Verify old artifact was deleted but recent one remains
        from ibutsu_server.db.models import Artifact

        artifacts = Artifact.query.all()
        artifact_ids = [a.id for a in artifacts]
        assert old_artifact_id not in artifact_ids
        assert recent_artifact_id in artifact_ids


def test_prune_old_files_minimum_months(make_artifact, flask_app):
    """Test prune_old_files doesn't delete files if months < 2."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(timezone.utc) - timedelta(days=180)
        old_artifact = make_artifact(upload_date=old_date)

        # Try to run with less than 2 months - should do nothing
        prune_old_files(months=1)

        from ibutsu_server.db.models import Artifact

        artifact = Artifact.query.get(old_artifact.id)
        assert artifact is not None


def test_prune_old_files_with_string_months(make_artifact, flask_app):
    """Test prune_old_files with string input for months."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(timezone.utc) - timedelta(days=180)
        old_artifact = make_artifact(upload_date=old_date)
        old_artifact_id = old_artifact.id

        # Pass months as string
        prune_old_files(months="5")

        from ibutsu_server.db.models import Artifact

        artifacts = Artifact.query.all()
        artifact_ids = [a.id for a in artifacts]
        assert old_artifact_id not in artifact_ids


def test_prune_old_results(make_result, flask_app):
    """Test prune_old_results deletes old results."""
    client, _ = flask_app

    with client.application.app_context():
        # Create old result
        old_date = datetime.now(timezone.utc) - timedelta(days=210)
        old_result = make_result(start_time=old_date, result="passed")
        old_result_id = old_result.id

        # Create recent result
        recent_date = datetime.now(timezone.utc) - timedelta(days=30)
        recent_result = make_result(start_time=recent_date, result="passed")
        recent_result_id = recent_result.id

        # Run the task
        prune_old_results(months=6)

        from ibutsu_server.db.models import Result

        results = Result.query.all()
        result_ids = [r.id for r in results]
        assert old_result_id not in result_ids
        assert recent_result_id in result_ids


def test_prune_old_results_minimum_months(make_result, flask_app):
    """Test prune_old_results doesn't delete if months < 4."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(timezone.utc) - timedelta(days=210)
        old_result = make_result(start_time=old_date, result="passed")

        prune_old_results(months=3)

        from ibutsu_server.db.models import Result

        result = Result.query.get(old_result.id)
        assert result is not None


def test_prune_old_runs(make_run, flask_app):
    """Test prune_old_runs deletes old runs."""
    client, _ = flask_app

    with client.application.app_context():
        # Create old run
        old_date = datetime.now(timezone.utc) - timedelta(days=400)
        old_run = make_run(start_time=old_date)
        old_run_id = old_run.id

        # Create recent run
        recent_date = datetime.now(timezone.utc) - timedelta(days=30)
        recent_run = make_run(start_time=recent_date)
        recent_run_id = recent_run.id

        # Run the task
        prune_old_runs(months=12)

        from ibutsu_server.db.models import Run

        runs = Run.query.all()
        run_ids = [r.id for r in runs]
        assert old_run_id not in run_ids
        assert recent_run_id in run_ids


def test_prune_old_runs_minimum_months(make_run, flask_app):
    """Test prune_old_runs doesn't delete if months < 10."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(timezone.utc) - timedelta(days=400)
        old_run = make_run(start_time=old_date)

        prune_old_runs(months=9)

        from ibutsu_server.db.models import Run

        run = Run.query.get(old_run.id)
        assert run is not None


def test_prune_old_imports(make_import, flask_app):
    """Test prune_old_imports deletes old import records."""
    client, _ = flask_app

    with client.application.app_context():
        # Create old import
        old_date = datetime.now(timezone.utc) - timedelta(days=90)
        old_import = make_import(created=old_date)
        old_import_id = old_import.id

        # Create recent import
        recent_date = datetime.now(timezone.utc) - timedelta(days=15)
        recent_import = make_import(created=recent_date)
        recent_import_id = recent_import.id

        # Run the task
        prune_old_imports(months=2)

        from ibutsu_server.db.models import Import

        imports = Import.query.all()
        import_ids = [i.id for i in imports]
        assert old_import_id not in import_ids
        assert recent_import_id in import_ids


# Tests for tasks.query module


def test_query_task_results(make_project, make_run, make_result, flask_app, fixed_time):
    """Test query_task for results."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create 30 results
        for i in range(30):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_{i}",
                result="passed",
                start_time=fixed_time,
            )

        # Query with pagination
        result = query_task(filter_=None, page=1, page_size=10, tablename="results")

        assert "results" in result
        assert "pagination" in result
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["pageSize"] == 10
        assert result["pagination"]["totalItems"] == 30
        assert result["pagination"]["totalPages"] == 3
        assert len(result["results"]) == 10


def test_query_task_with_filter(make_project, make_run, make_result, flask_app, fixed_time):
    """Test query_task with filter."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create results with different statuses
        for i in range(10):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_p_{i}",
                result="passed",
                start_time=fixed_time,
            )
        for i in range(5):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_f_{i}",
                result="failed",
                start_time=fixed_time,
            )

        # Query only failed results
        result = query_task(filter_=["result=failed"], page=1, page_size=25, tablename="results")

        assert result["pagination"]["totalItems"] == 5
        assert len(result["results"]) == 5


def test_query_task_runs(make_project, make_run, flask_app, fixed_time):
    """Test query_task for runs."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create runs
        for i in range(15):
            make_run(project_id=project.id, start_time=fixed_time, metadata={"build": i})

        result = query_task(filter_=None, page=1, page_size=10, tablename="runs")

        assert "runs" in result
        assert result["pagination"]["totalItems"] == 15
        assert len(result["runs"]) == 10


# Tests for tasks.runs module


def test_update_run(make_project, make_run, make_result, flask_app, fixed_time):
    """Test update_run updates run summary from results."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(
            project_id=project.id,
            summary={"collected": 10, "tests": 0, "failures": 0, "errors": 0},
        )

        # Create results for the run
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="passed",
            duration=1.5,
            start_time=fixed_time,
        )
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="failed",
            duration=2.0,
            start_time=fixed_time,
        )
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="error",
            duration=1.0,
            start_time=fixed_time,
        )

        # Mock the lock to prevent Redis dependency
        with patch("ibutsu_server.tasks.runs.lock"):
            update_run(str(run.id))

        # Refresh run from database
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Run

        session.expire_all()
        updated_run = Run.query.get(run.id)

        assert updated_run.summary["tests"] == 3
        assert updated_run.summary["passes"] == 1
        assert updated_run.summary["failures"] == 1
        assert updated_run.summary["errors"] == 1
        assert updated_run.duration == 4.5


def test_update_run_nonexistent(flask_app):
    """Test update_run with non-existent run ID."""
    client, _ = flask_app

    with client.application.app_context(), patch("ibutsu_server.tasks.runs.lock"):
        # Should not raise an error
        result = update_run("00000000-0000-0000-0000-000000000000")
        assert result is None


def test_sync_aborted_runs(make_project, make_run, make_result, flask_app):
    """Test sync_aborted_runs finds and syncs runs with mismatched result counts."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create a recent run with summary.tests not matching actual results
        recent_time = datetime.now(timezone.utc) - timedelta(minutes=30)
        run = make_run(
            project_id=project.id,
            start_time=recent_time,
            summary={"tests": 10, "collected": 10},  # Says 10 tests
        )

        # But only create 5 results
        for _i in range(5):
            make_result(
                run_id=run.id, project_id=project.id, result="passed", start_time=recent_time
            )

        # Mock the task's apply_async to verify it's called
        with (
            patch.object(update_run, "apply_async") as mock_apply,
            patch("ibutsu_server.tasks.runs.datetime") as mock_datetime,
        ):
            # Mock datetime to make the run appear recent
            mock_datetime.utcnow.return_value = datetime.now(timezone.utc)

            sync_aborted_runs()

            # Verify update_run was scheduled for this run
            mock_apply.assert_called_once()
            call_args = mock_apply.call_args
            assert call_args[0][0][0] == run.id
