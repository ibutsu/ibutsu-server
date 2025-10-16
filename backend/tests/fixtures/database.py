"""
Database fixtures for integration testing.

This module provides Flask app setup, database session management,
and builder fixtures for creating test data.
"""

import logging

import connexion
import pytest

from ibutsu_server.encoder import IbutsuJSONProvider

# ============================================================================
# DATABASE FIXTURES - Flask app and database session management
# ============================================================================


@pytest.fixture(scope="session")
def create_app():
    """
    Create a Connexion app for session-scoped testing.
    NOTE: This is legacy. Prefer using flask_app fixture for integration tests.
    """
    logging.getLogger("connexion.operation").setLevel("ERROR")
    app = connexion.App(__name__, specification_dir="../openapi/")
    app.app.json_provider_class = IbutsuJSONProvider
    app.add_api("openapi.yaml")
    return app.app


@pytest.fixture
def flask_app():
    """
    Create Flask app for integration testing with SQLite in-memory database.

    This fixture provides:
    - Real Flask application with full initialization
    - SQLite in-memory database (fast, isolated)
    - Test superadmin user with JWT token
    - Test client for making API requests

    Returns:
        tuple: (test_client, jwt_token)

    Example:
        def test_my_endpoint(flask_app):
            client, jwt_token = flask_app
            response = client.get('/api/projects',
                                headers={'Authorization': f'Bearer {jwt_token}'})
            assert response.status_code == 200
    """
    import ibutsu_server.tasks
    from ibutsu_server import get_app
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token, User
    from ibutsu_server.tasks import create_celery_app
    from ibutsu_server.util.jwt import generate_token

    logging.getLogger("connexion.operation").setLevel("ERROR")
    extra_config = {
        "TESTING": True,
        "LIVESERVER_PORT": 0,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "GOOGLE_CLIENT_ID": "123456@client.google.com",
        "GITHUB_CLIENT_ID": None,
        "FACEBOOK_APP_ID": None,
        "GITLAB_CLIENT_ID": "thisisafakegitlabclientid",
        "GITLAB_BASE_URL": "https://gitlab.com",
        "JWT_SECRET": "thisisafakejwtsecretvalue",
        "KEYCLOAK_BASE_URL": None,
        "KEYCLOAK_CLIENT_ID": None,
        "KEYCLOAK_AUTH_PATH": "auth",
        "CELERY_BROKER_URL": "redis://localhost:6379/0",
        "CELERY_RESULT_BACKEND": "redis://localhost:6379/0",
    }
    app = get_app(**extra_config)
    create_celery_app(app)

    # Add a test user
    with app.app_context():
        test_user = User(
            name="Test User", email="test@example.com", is_active=True, is_superadmin=True
        )
        session.add(test_user)
        session.commit()
        jwt_token = generate_token(test_user.id)
        token = Token(name="login-token", user=test_user, token=jwt_token)
        session.add(token)
        session.commit()
        session.refresh(test_user)

    if ibutsu_server.tasks.task is None:
        ibutsu_server.tasks.task = mock_task

    with app.test_client() as client:
        yield client, jwt_token


def mock_task(*args, **kwargs):
    """Mock task function for Celery tasks in tests."""
    pass


@pytest.fixture
def app_context(flask_app):
    """
    Create an application context for testing.

    Use this when you need to access the database or perform operations
    that require an application context outside of a request.

    Example:
        def test_database_operation(flask_app, app_context):
            from ibutsu_server.db.models import Project
            project = Project.query.filter_by(name='test').first()
    """
    client, _ = flask_app
    with client.application.app_context():
        yield


@pytest.fixture
def db_session(flask_app):
    """
    Direct access to database session with automatic cleanup.

    This fixture provides direct access to the SQLAlchemy session within
    an application context. Any changes are automatically available to the
    test and will be cleaned up when the test completes.

    Example:
        def test_create_project(db_session):
            from ibutsu_server.db.models import Project
            project = Project(name='test', title='Test Project')
            db_session.add(project)
            db_session.commit()
            assert Project.query.filter_by(name='test').first() is not None
    """
    from ibutsu_server.db.base import session

    client, _ = flask_app
    with client.application.app_context():
        yield session


# ============================================================================
# DATABASE BUILDER FIXTURES - Factories for creating test data
# ============================================================================


@pytest.fixture
def make_project(db_session):
    """
    Factory to create test projects in the database.

    Example:
        def test_with_project(make_project):
            project = make_project(name='my-project', title='My Project')
            assert project.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import Project

    def _make_project(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "name": f"test-project-{uuid4().hex[:8]}",
            "title": "Test Project",
        }
        defaults.update(kwargs)
        project = Project(**defaults)
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        return project

    return _make_project


@pytest.fixture
def make_run(db_session):
    """
    Factory to create test runs in the database.

    Example:
        def test_with_run(make_project, make_run):
            project = make_project()
            run = make_run(project_id=project.id, metadata={'build': 100})
            assert run.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import Run

    def _make_run(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "metadata": {},
        }
        defaults.update(kwargs)
        run = Run(**defaults)
        db_session.add(run)
        db_session.commit()
        db_session.refresh(run)
        return run

    return _make_run


@pytest.fixture
def make_result(db_session):
    """
    Factory to create test results in the database.

    Example:
        def test_with_result(make_project, make_run, make_result):
            project = make_project()
            run = make_run(project_id=project.id)
            result = make_result(
                run_id=run.id,
                project_id=project.id,
                test_id='test.example',
                result='passed'
            )
            assert result.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import Result

    def _make_result(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "duration": 1.0,
            "result": "passed",
            "test_id": f"test.example.{uuid4().hex[:8]}",
            "metadata": {},
        }
        defaults.update(kwargs)
        result = Result(**defaults)
        db_session.add(result)
        db_session.commit()
        db_session.refresh(result)
        return result

    return _make_result


@pytest.fixture
def make_user(db_session):
    """
    Factory to create test users in the database.

    Example:
        def test_with_user(make_user):
            user = make_user(email='test@example.com', name='Test User')
            assert user.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import User

    def _make_user(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "name": f"Test User {uuid4().hex[:8]}",
            "email": f"test-{uuid4().hex[:8]}@example.com",
            "is_active": True,
            "is_superadmin": False,
        }
        defaults.update(kwargs)
        user = User(**defaults)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make_user


@pytest.fixture
def make_widget_config(db_session):
    """
    Factory to create test widget configs in the database.

    Example:
        def test_with_widget(make_project, make_widget_config):
            project = make_project()
            widget = make_widget_config(
                project_id=project.id,
                widget='run-aggregator',
                params={'weeks': 4}
            )
            assert widget.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import WidgetConfig

    def _make_widget_config(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "widget": "test-widget",
            "type": "widget",
            "params": {},
        }
        defaults.update(kwargs)
        widget_config = WidgetConfig(**defaults)
        db_session.add(widget_config)
        db_session.commit()
        db_session.refresh(widget_config)
        return widget_config

    return _make_widget_config


@pytest.fixture
def make_group(db_session):
    """
    Factory to create test groups in the database.

    Example:
        def test_with_group(make_group):
            group = make_group(name='test-group')
            assert group.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import Group

    def _make_group(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "name": f"test-group-{uuid4().hex[:8]}",
        }
        defaults.update(kwargs)
        group = Group(**defaults)
        db_session.add(group)
        db_session.commit()
        db_session.refresh(group)
        return group

    return _make_group


@pytest.fixture
def make_dashboard(db_session):
    """
    Factory to create test dashboards in the database.

    Example:
        def test_with_dashboard(make_project, make_dashboard):
            project = make_project()
            dashboard = make_dashboard(project_id=project.id, title='Test Dashboard')
            assert dashboard.id is not None
    """
    from uuid import uuid4

    from ibutsu_server.db.models import Dashboard

    def _make_dashboard(**kwargs):
        defaults = {
            "id": str(uuid4()),
            "title": f"test-dashboard-{uuid4().hex[:8]}",
        }
        defaults.update(kwargs)
        dashboard = Dashboard(**defaults)
        db_session.add(dashboard)
        db_session.commit()
        db_session.refresh(dashboard)
        return dashboard

    return _make_dashboard
