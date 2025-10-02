import pytest


@pytest.fixture
def flask_app_health():
    """Create Flask app for health testing"""
    import logging

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


class TestHealthController:
    """HealthController integration test stubs"""

    def test_get_database_health(self, flask_app_health):
        """Test case for get_database_health

        Get a health report for the database
        """
        client, jwt_token = flask_app_health

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open("/api/health/database", method="GET", headers=headers)
        assert response.status_code == 503, f"Response body is : {response.data.decode('utf-8')}"

    def test_get_health(self, flask_app_health):
        """Test case for get_health

        Get a general health report
        """
        client, jwt_token = flask_app_health

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open("/api/health", method="GET", headers=headers)
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
