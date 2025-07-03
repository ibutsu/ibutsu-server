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
    with (
        client.application.app_context(),
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

    with (
        client.application.app_context(),
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


# Tests for tasks.db seed_users


def test_seed_users_create_new_users_and_add_to_project(make_project, flask_app):
    """Test seed_users creates new users and adds them to project"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id

        projects_data = {
            "test-project": {
                "users": ["alice@example.com", "bob@example.com"],
            }
        }

        seed_users(projects_data)

        # Verify users were created
        alice = User.query.filter_by(email="alice@example.com").first()
        bob = User.query.filter_by(email="bob@example.com").first()

        assert alice is not None
        assert bob is not None
        assert alice.name == "alice"
        assert bob.name == "bob"

        # Verify users were added to project
        assert project_id in [p.id for p in alice.projects]
        assert project_id in [p.id for p in bob.projects]


def test_seed_users_with_owner(make_project, flask_app):
    """Test seed_users sets project owner"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import Project, User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id

        projects_data = {
            "test-project": {
                "owner": "owner@example.com",
                "users": ["user1@example.com"],
            }
        }

        seed_users(projects_data)

        # Verify owner was created
        owner = User.query.filter_by(email="owner@example.com").first()
        assert owner is not None

        # Verify owner was set on project
        updated_project = Project.query.get(project_id)
        assert updated_project.owner == owner


def test_seed_users_existing_user(make_project, make_user, flask_app):
    """Test seed_users handles existing users"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id
        existing_user = make_user(email="existing@example.com", name="Existing User")
        existing_user_id = existing_user.id

        projects_data = {
            "test-project": {
                "users": ["existing@example.com", "new@example.com"],
            }
        }

        seed_users(projects_data)

        # Verify existing user was not duplicated
        users = User.query.filter_by(email="existing@example.com").all()
        assert len(users) == 1
        assert users[0].id == existing_user_id

        # Verify existing user was added to project
        updated_existing_user = User.query.filter_by(email="existing@example.com").first()
        assert project_id in [p.id for p in updated_existing_user.projects]

        # Verify new user was created
        new_user = User.query.filter_by(email="new@example.com").first()
        assert new_user is not None
        assert project_id in [p.id for p in new_user.projects]


def test_seed_users_user_already_in_project(make_project, make_user, flask_app):
    """Test seed_users doesn't duplicate project membership"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id
        user = make_user(email="user@example.com")

        # Manually add user to project first
        user.projects.append(project)
        from ibutsu_server.db.base import session

        session.add(user)
        session.commit()

        # Try to add same user again via seed_users
        projects_data = {
            "test-project": {
                "users": ["user@example.com"],
            }
        }

        seed_users(projects_data)

        # Verify user is still only in project once
        updated_user = User.query.filter_by(email="user@example.com").first()
        project_ids = [p.id for p in updated_user.projects]
        assert project_ids.count(project_id) == 1


def test_seed_users_nonexistent_project(flask_app):
    """Test seed_users handles non-existent project"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        projects_data = {
            "nonexistent-project": {
                "users": ["user@example.com"],
            }
        }

        # Should not raise error
        seed_users(projects_data)

        # Verify user was not created since project doesn't exist
        from ibutsu_server.db.models import User

        user = User.query.filter_by(email="user@example.com").first()
        assert user is None


def test_seed_users_empty_projects(flask_app):
    """Test seed_users with empty projects dict"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        # Should not raise error
        result = seed_users({})
        assert result is None


def test_seed_users_none_projects(flask_app):
    """Test seed_users with None projects"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        # Should not raise error
        result = seed_users(None)
        assert result is None


def test_seed_users_multiple_projects(make_project, flask_app):
    """Test seed_users with multiple projects"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

        project1 = make_project(name="project-1")
        project2 = make_project(name="project-2")
        project1_id = project1.id
        project2_id = project2.id

        projects_data = {
            "project-1": {
                "users": ["alice@example.com", "bob@example.com"],
            },
            "project-2": {
                "users": ["bob@example.com", "charlie@example.com"],
            },
        }

        seed_users(projects_data)

        # Verify users were created
        alice = User.query.filter_by(email="alice@example.com").first()
        bob = User.query.filter_by(email="bob@example.com").first()
        charlie = User.query.filter_by(email="charlie@example.com").first()

        assert alice is not None
        assert bob is not None
        assert charlie is not None

        # Verify alice is only in project1
        alice_project_ids = [p.id for p in alice.projects]
        assert project1_id in alice_project_ids
        assert project2_id not in alice_project_ids

        # Verify bob is in both projects
        bob_project_ids = [p.id for p in bob.projects]
        assert project1_id in bob_project_ids
        assert project2_id in bob_project_ids

        # Verify charlie is only in project2
        charlie_project_ids = [p.id for p in charlie.projects]
        assert project1_id not in charlie_project_ids
        assert project2_id in charlie_project_ids


def test_seed_users_owner_is_also_user(make_project, flask_app):
    """Test seed_users when owner is also in users list"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import Project, User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id

        projects_data = {
            "test-project": {
                "owner": "owner@example.com",
                "users": ["owner@example.com", "user1@example.com"],
            }
        }

        seed_users(projects_data)

        # Verify owner was created once
        owners = User.query.filter_by(email="owner@example.com").all()
        assert len(owners) == 1

        owner = owners[0]

        # Verify owner is set on project
        updated_project = Project.query.get(project_id)
        assert updated_project.owner == owner

        # Verify owner is in project users
        assert project_id in [p.id for p in owner.projects]


def test_seed_users_updates_existing_owner(make_project, make_user, flask_app):
    """Test seed_users updates project owner if already exists"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import Project
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id
        old_owner = make_user(email="old@example.com")
        old_owner_email = old_owner.email
        project.owner = old_owner
        from ibutsu_server.db.base import session

        session.add(project)
        session.commit()

        projects_data = {
            "test-project": {
                "owner": "new@example.com",
                "users": [],
            }
        }

        seed_users(projects_data)

        # Verify new owner was set
        updated_project = Project.query.get(project_id)
        assert updated_project.owner.email == "new@example.com"
        assert updated_project.owner.email != old_owner_email


def test_seed_users_empty_users_list(make_project, flask_app):
    """Test seed_users with empty users list"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        make_project(name="test-project")

        projects_data = {
            "test-project": {
                "users": [],
            }
        }

        # Should not raise error
        seed_users(projects_data)


def test_seed_users_no_users_key(make_project, flask_app):
    """Test seed_users when users key is missing"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import Project
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id

        projects_data = {
            "test-project": {
                "owner": "owner@example.com",
            }
        }

        # Should not raise error
        seed_users(projects_data)

        # Verify owner was still set
        updated_project = Project.query.get(project_id)
        assert updated_project.owner is not None


def test_seed_users_exception_handling(make_project, flask_app):
    """Test seed_users handles exceptions gracefully"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        make_project(name="test-project")

        # Create invalid data that might cause an exception
        projects_data = {
            "test-project": {
                "users": ["valid@example.com"],
            }
        }

        # Mock the session.add to raise an exception
        with patch("ibutsu_server.tasks.db.session.add", side_effect=Exception("DB Error")):
            # Should not raise, should return None
            result = seed_users(projects_data)
            assert result is None
