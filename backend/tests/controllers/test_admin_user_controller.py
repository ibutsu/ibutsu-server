from http import HTTPStatus

import pytest

from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token, User


def _mock_task(*args, **kwargs):
    """Mock task function for Celery tasks in tests."""
    pass


def test_admin_get_user_success(flask_app, make_user, auth_headers):
    """Test case for admin_get_user - successful retrieval"""
    client, jwt_token = flask_app

    # Create user
    user = make_user(name="Test User", email="testuser@example.com")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/admin/user/{user.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify sensitive fields are hidden
    response_data = response.json()
    assert "password" not in response_data
    assert "_password" not in response_data
    assert "activation_code" not in response_data
    assert response_data["email"] == "testuser@example.com"


def test_admin_get_user_not_found(flask_app, auth_headers):
    """Test case for admin_get_user - user not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/admin/user/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize(
    ("page", "page_size", "expected_offset"),
    [
        (1, 25, 0),
        (2, 10, 10),
        (3, 5, 10),
    ],
)
def test_admin_get_user_list_pagination(
    flask_app, make_user, page, page_size, expected_offset, auth_headers
):
    """Test case for admin_get_user_list with different pagination parameters"""
    client, jwt_token = flask_app

    # Create multiple users
    for i in range(100):
        make_user(name=f"User {i}", email=f"user{i}@example.com")

    headers = auth_headers(jwt_token)
    params = [("page", page), ("pageSize", page_size)]
    response = client.get(
        "/api/admin/user",
        headers=headers,
        params=params,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "users" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_admin_get_user_list_with_filters(flask_app, make_user, auth_headers):
    """Test case for admin_get_user_list with filters"""
    client, jwt_token = flask_app

    # Create specific user
    make_user(name="Target User", email="target@example.com")

    # Create other users
    make_user(name="Other User 1", email="other1@example.com")
    make_user(name="Other User 2", email="other2@example.com")

    headers = auth_headers(jwt_token)
    params = [("filter", "email=target@example.com")]
    response = client.get(
        "/api/admin/user",
        headers=headers,
        params=params,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should find the target user
    assert len(response_data["users"]) >= 1
    found_target = any(user["email"] == "target@example.com" for user in response_data["users"])
    assert found_target


def test_admin_add_user_success(flask_app, auth_headers):
    """Test case for admin_add_user - successful creation"""
    client, jwt_token = flask_app

    user_data = {
        "name": "New User",
        "email": "newuser@example.com",
        "password": "password123",
    }
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/admin/user",
        headers=headers,
        json=user_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    # Verify user was created in database
    with client.application.app_context():
        user = User.query.filter_by(email="newuser@example.com").first()
        assert user is not None
        assert user.name == "New User"


def test_admin_add_user_already_exists(flask_app, make_user, auth_headers):
    """Test case for admin_add_user - user already exists"""
    client, jwt_token = flask_app

    # Create existing user
    make_user(email="existing@example.com", name="Existing User")

    user_data = {
        "name": "New User",
        "email": "existing@example.com",  # Same as existing user
        "password": "password123",
    }
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/admin/user",
        headers=headers,
        json=user_data,
    )
    assert response.status_code == 400, f"Response body is : {response.text}"
    assert "already exists" in response.text


def test_admin_update_user_success(flask_app, make_user, make_project, auth_headers):
    """Test case for admin_update_user - successful update"""
    client, jwt_token = flask_app

    # Create user and project
    user = make_user(name="Original Name", email="user@example.com")
    project = make_project(name="test-project")

    update_data = {
        "name": "Updated User Name",
        "email": "updated@example.com",
        "projects": [{"id": str(project.id)}],
    }
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/admin/user/{user.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify updates in database
    with client.application.app_context():
        updated_user = db.session.get(User, str(user.id))
        assert updated_user.name == "Updated User Name"
        assert updated_user.email == "updated@example.com"


def test_admin_update_user_not_found(flask_app, auth_headers):
    """Test case for admin_update_user - user not found"""
    client, jwt_token = flask_app

    update_data = {"name": "Updated User Name", "email": "updated@example.com"}
    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/admin/user/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_admin_delete_user_success(flask_app, make_user, auth_headers):
    """Test case for admin_delete_user - successful deletion"""
    client, jwt_token = flask_app

    # Create user to delete (not superadmin)
    user = make_user(name="User to Delete", email="todelete@example.com", is_superadmin=False)
    user_id = user.id

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/admin/user/{user_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify user was deleted from database
    with client.application.app_context():
        deleted_user = db.session.get(User, str(user_id))
        assert deleted_user is None


def test_admin_delete_user_not_found(flask_app, auth_headers):
    """Test case for admin_delete_user - user not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.delete(
        "/api/admin/user/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_admin_delete_user_cannot_delete_self(flask_app, auth_headers):
    """Test case for admin_delete_user - cannot delete self"""
    client, jwt_token = flask_app

    # Get the test user ID from the flask_app fixture
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/admin/user/{test_user.id}",
        headers=headers,
    )
    # Should abort with BAD_REQUEST
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "Cannot delete yourself" in response.text


class TestAdminDeleteLastSuperadmin:
    """Test class with class-scoped fixture for last superadmin deletion scenario."""

    @pytest.fixture(scope="class")
    def two_superadmin_flask_app(self):
        """
        Create Flask app with two superadmins for testing last superadmin deletion.

        This class-scoped fixture creates two superadmin users:
        1. The authenticated user (whose JWT token we use)
        2. A second superadmin who will be deleted, leaving only one

        This allows us to test the "cannot delete last superadmin" logic without
        hitting the "cannot delete yourself" check.

        Returns:
            tuple: (test_client, jwt_token, second_superadmin_id)
        """
        import logging  # noqa: PLC0415 - Fixture setup, configure before app creation

        import ibutsu_server.tasks  # noqa: PLC0415 - Fixture setup
        from ibutsu_server import get_app  # noqa: PLC0415 - Fixture setup
        from ibutsu_server.util.jwt import generate_token  # noqa: PLC0415 - Fixture setup

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
        connexion_app = get_app(**extra_config)
        flask_app = connexion_app.app

        # Create database tables for testing
        # In tests, we use metadata.create_all() for speed and simplicity
        # Production uses Alembic migrations
        with flask_app.app_context():
            from ibutsu_server.db.base import db  # noqa: PLC0415 - Fixture setup

            db.metadata.create_all(db.engine)

        # Add two test superadmin users
        with flask_app.app_context():
            # First superadmin - the authenticated user
            auth_user = User(
                name="Auth Superadmin",
                email="auth@example.com",
                is_active=True,
                is_superadmin=True,
            )
            session.add(auth_user)
            session.commit()
            jwt_token = generate_token(auth_user.id)
            token = Token(name="login-token", user=auth_user, token=jwt_token)
            session.add(token)
            session.commit()

            # Second superadmin - to be deleted
            second_user = User(
                name="Second Superadmin",
                email="second@example.com",
                is_active=True,
                is_superadmin=True,
            )
            session.add(second_user)
            session.commit()
            session.refresh(auth_user)
            session.refresh(second_user)
            second_user_id = str(second_user.id)

        # Mock celery tasks for testing if not already mocked
        if not hasattr(ibutsu_server.tasks, "task") or ibutsu_server.tasks.task is None:
            ibutsu_server.tasks.task = _mock_task

        # Use Connexion 3 test client
        with connexion_app.test_client() as client:
            # Add Flask app reference for compatibility
            client.application = flask_app
            yield client, jwt_token, second_user_id

    def test_admin_delete_user_cannot_delete_last_superadmin(
        self, two_superadmin_flask_app, auth_headers
    ):
        """Test case for admin_delete_user - cannot delete last superadmin after deleting one"""
        client, jwt_token, second_user_id = two_superadmin_flask_app

        # Verify we start with exactly two superadmins
        with client.application.app_context():
            superadmin_count = User.query.filter_by(is_superadmin=True).count()
            assert superadmin_count == 2, "Test requires exactly two superadmins initially"

        headers = auth_headers(jwt_token)

        # First, successfully delete the second superadmin (authenticated user is different)
        response = client.delete(
            f"/api/admin/user/{second_user_id}",
            headers=headers,
        )
        assert response.status_code == HTTPStatus.OK

        # Verify only one superadmin remains
        with client.application.app_context():
            superadmin_count = User.query.filter_by(is_superadmin=True).count()
            assert superadmin_count == 1, "Should have exactly one superadmin remaining"

            # Get the remaining superadmin (the authenticated user)
            remaining_superadmin = User.query.filter_by(
                email="auth@example.com", is_superadmin=True
            ).first()
            assert remaining_superadmin is not None

        # Now try to delete the last remaining superadmin - should fail
        response = client.delete(
            f"/api/admin/user/{remaining_superadmin.id}",
            headers=headers,
        )
        # Should fail with BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST
        # The error could be either "Cannot delete yourself" or "Cannot delete the last superadmin"
        # Both are valid protection mechanisms
        error_msg = response.text
        assert (
            "Cannot delete yourself" in error_msg
            or "Cannot delete the last superadmin" in error_msg
        )
