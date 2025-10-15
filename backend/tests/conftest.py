"""
Consolidated test fixtures for controller tests.
"""

import logging
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import connexion
import pytest

from ibutsu_server.encoder import IbutsuJSONProvider
from tests.test_util import MockDashboard, MockGroup, MockProject, MockToken, MockUser

# Common mock IDs - Standardized across all tests
MOCK_USER_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_ADMIN_USER_ID = "12345678-1234-1234-1234-123456789012"
MOCK_PROJECT_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_GROUP_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_DASHBOARD_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_TOKEN_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_IMPORT_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_RESULT_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_RUN_ID = "6b26876f-bcd9-49f3-b5bd-35f895a345d1"
MOCK_ARTIFACT_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_WIDGET_CONFIG_ID = "91e750be-2ef2-4d85-a50e-2c9366cefd9f"
MOCK_TASK_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"


@pytest.fixture(scope="session")
def create_app():
    logging.getLogger("connexion.operation").setLevel("ERROR")
    app = connexion.App(__name__, specification_dir="../openapi/")
    app.app.json_provider_class = IbutsuJSONProvider
    app.add_api("openapi.yaml")
    return app.app


@pytest.fixture
def mock_user():
    """Standard mock user for tests."""
    return MockUser(
        id=MOCK_USER_ID,
        name="Test User",
        email="test@example.com",
        password="hashed_password",
        is_superadmin=False,
    )


@pytest.fixture
def mock_admin_user():
    """Mock admin user for admin tests."""
    return MockUser(
        id="admin-user-id",
        name="Admin User",
        email="admin@example.com",
        password="hashed_password",
        is_superadmin=True,
    )


@pytest.fixture
def mock_project():
    """Standard mock project for tests."""
    return MockProject(
        id=MOCK_PROJECT_ID,
        name="test-project",
        title="Test Project",
        owner_id=MOCK_USER_ID,
        group_id=MOCK_GROUP_ID,
    )


@pytest.fixture
def mock_group():
    """Standard mock group for tests."""
    return MockGroup(
        id=MOCK_GROUP_ID,
        name="test-group",
    )


@pytest.fixture
def mock_dashboard():
    """Standard mock dashboard for tests."""
    return MockDashboard(
        id=MOCK_DASHBOARD_ID,
        title="Test Dashboard",
        project_id=MOCK_PROJECT_ID,
        user_id=MOCK_USER_ID,
    )


@pytest.fixture
def mock_token():
    """Standard mock token for tests."""
    return MockToken(
        id=MOCK_TOKEN_ID,
        name="test-token",
        user_id=MOCK_USER_ID,
        expires=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_session():
    """Mock database session."""
    with patch("ibutsu_server.db.base.session") as mock:
        yield mock


@pytest.fixture
def mock_project_has_user():
    """Mock project_has_user utility function."""
    with patch("ibutsu_server.util.projects.project_has_user") as mock:
        mock.return_value = True
        yield mock


@pytest.fixture
def mock_add_user_filter():
    """Mock add_user_filter utility function."""
    with patch("ibutsu_server.filters.add_user_filter") as mock:
        mock_query = MagicMock()
        mock_query.count.return_value = 1
        mock.return_value = mock_query
        yield mock


@pytest.fixture
def mock_validate_admin():
    """Mock validate_admin decorator for admin tests."""
    with patch("ibutsu_server.util.admin.validate_admin") as mock:
        mock.side_effect = lambda func: func  # Pass through decorator
        yield mock


@pytest.fixture
def mock_abort():
    """Mock Flask abort function for admin tests."""
    with patch("flask.abort") as mock:
        mock.side_effect = Exception("Aborted")  # Simulate abort behavior
        yield mock


class ControllerMockFactory:
    """Factory for creating controller-specific mocks."""

    @staticmethod
    def create_model_mock(controller_module, model_name, mock_instance):
        """Create a mock for a database model class."""
        patcher = patch(f"ibutsu_server.controllers.{controller_module}.{model_name}")
        mock_class = patcher.start()
        mock_class.query.get.return_value = mock_instance
        mock_class.from_dict.return_value = mock_instance
        return patcher, mock_class

    @staticmethod
    def create_utility_mock(controller_module, utility_name, return_value=True):
        """Create a mock for a utility function."""
        patcher = patch(f"ibutsu_server.controllers.{controller_module}.{utility_name}")
        mock_func = patcher.start()
        mock_func.return_value = return_value
        return patcher, mock_func


@pytest.fixture
def controller_mocks_factory():
    """Factory function for creating controller-specific mocks."""

    def create_mocks(controller_module, models=None, utilities=None):
        models = models or []
        utilities = utilities or []

        patchers = []
        mocks = {}

        # Mock session
        session_patcher = patch(f"ibutsu_server.controllers.{controller_module}.session")
        mocks["session"] = session_patcher.start()
        patchers.append(session_patcher)

        # Mock models
        for model in models:
            patcher, mock_class = ControllerMockFactory.create_model_mock(
                controller_module,
                model,
                None,  # Will be set by individual tests
            )
            mocks[model.lower()] = mock_class
            patchers.append(patcher)

        # Mock utilities
        for utility in utilities:
            patcher, mock_func = ControllerMockFactory.create_utility_mock(
                controller_module, utility
            )
            mocks[utility] = mock_func
            patchers.append(patcher)

        return mocks, patchers

    return create_mocks


@pytest.fixture
def pagination_test_cases():
    """Common pagination test cases."""
    return [
        (1, 25),
        (2, 10),
        (1, 50),
        (3, 5),
    ]


@pytest.fixture
def http_headers():
    """Standard HTTP headers for API requests."""
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


@pytest.fixture
def auth_headers(http_headers):
    """HTTP headers with authorization."""
    # This will be set by individual tests that need authentication
    return lambda token: {**http_headers, "Authorization": f"Bearer {token}"}


@pytest.fixture
def flask_app():
    """Create Flask app for testing - consolidated fixture for all controller tests."""
    import ibutsu_server.tasks
    from ibutsu_server import get_app
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token, User
    from ibutsu_server.tasks import create_celery_app
    from ibutsu_server.test import mock_task
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
    pass


@pytest.fixture
def app_context(flask_app):
    """Create an application context for testing."""
    client, _ = flask_app
    with client.application.app_context():
        yield


@pytest.fixture
def mocked_celery():
    """Mock Celery app for testing."""
    with patch("ibutsu_server.tasks.celery") as mock:
        yield mock
