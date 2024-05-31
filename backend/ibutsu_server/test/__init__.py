import logging
from inspect import isfunction

from flask_testing import TestCase

import ibutsu_server.tasks
from ibutsu_server import get_app
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token, User
from ibutsu_server.tasks import create_celery_app
from ibutsu_server.util import merge_dicts
from ibutsu_server.util.jwt import generate_token


def mock_task(*args, **kwargs):
    if args and isfunction(args[0]):
        func = args[0]

        def wrap(*args, **kwargs):
            return func(*args, **kwargs)

        wrap._orig_func = func
        return wrap
    else:

        def decorate(func):
            def _wrapped(*args, **kwargs):
                return func(*args, **kwargs)

            _wrapped._orig_func = func
            return _wrapped

        return decorate


class BaseTestCase(TestCase):
    def create_app(self):
        logging.getLogger("connexion.operation").setLevel("ERROR")
        extra_config = {
            "TESTING": True,
            "LIVESERVER_PORT": 0,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "GOOGLE_CLIENT_ID": "123456@client.google.com",
            "GITHUB_CLIENT_ID": None,
            "FACEBOOK_APP_ID": None,
            "GITLAB_CLIENT_ID": "dfgfdgh4563453456dsfgdsfg456",
            "GITLAB_BASE_URL": "https://gitlab.com",
            "JWT_SECRET": "89807erkjhdfgu768dfsgdsfg345r",
            "KEYCLOAK_BASE_URL": None,
            "KEYCLOAK_CLIENT_ID": None,
        }
        app = get_app(**extra_config)
        create_celery_app(app)

        # Add a test user
        with app.app_context():
            self.test_user = User(name="Test User", email="test@example.com", is_active=True)
            session.add(self.test_user)
            session.commit()
            self.jwt_token = generate_token(self.test_user.id)
            token = Token(name="login-token", user=self.test_user, token=self.jwt_token)
            session.add(token)
            session.commit()
            session.refresh(self.test_user)

        if ibutsu_server.tasks.task is None:
            ibutsu_server.tasks.task = mock_task
        return app

    def assert_201(self, response, message=None):
        """
        Checks if response status code is 201
        :param response: Flask response
        :param message: Message to display on test failure
        """
        self.assert_status(response, 201, message)

    def assert_503(self, response, message=None):
        """
        Checks if response status code is 503
        :param response: Flask response
        :param message: Message to display on test failure
        """
        self.assert_status(response, 503, message)

    def assert_equal(self, first, second, msg=None):
        """Alias"""
        return self.assertEqual(first, second, msg)

    def assert_not_equal(self, first, second, msg=None):
        """Alias"""
        return self.assertNotEqual(first, second, msg)


class MockModel:
    """Mock model object"""

    COLUMNS = ["id"]

    def __init__(self, **fields):
        for column in self.COLUMNS:
            if column in fields.keys():
                setattr(self, column, fields[column])
            else:
                setattr(self, column, None)

    def to_dict(self):
        record_dict = {col: self.__dict__[col] for col in self.COLUMNS}
        # when outputting info, translate data to metadata
        if record_dict.get("data"):
            record_dict["metadata"] = record_dict.pop("data")
        # If we have any items that are not JSON serializable, fix them
        for key, value in record_dict.items():
            if isinstance(value, MockModel):
                record_dict[key] = value.to_dict()
            elif isinstance(value, list):
                for index, item in enumerate(record_dict[key]):
                    if isinstance(item, MockModel):
                        record_dict[key][index] = item.to_dict()
        return record_dict

    @classmethod
    def from_dict(cls, **record_dict):
        # because metadata is a reserved attr name, translate it to data
        if record_dict.get("metadata"):
            record_dict["data"] = record_dict.pop("metadata")
        return cls(**record_dict)

    def update(self, record_dict):
        if "id" in record_dict:
            record_dict.pop("id")
        group_dict = self.to_dict()
        merge_dicts(group_dict, record_dict)
        if group_dict.get("metadata"):
            group_dict["data"] = group_dict.pop("metadata")
        if record_dict.get("metadata"):
            record_dict["data"] = record_dict.get("metadata")
        for key, value in record_dict.items():
            setattr(self, key, value)


class MockArtifact(MockModel):
    COLUMNS = ["id", "filename", "result_id", "data", "content", "result"]


class MockGroup(MockModel):
    COLUMNS = ["id", "name", "data"]


class MockImport(MockModel):
    COLUMNS = ["id", "filename", "format", "data", "status"]


class MockProject(MockModel):
    COLUMNS = ["id", "name", "title", "owner_id", "group_id", "users"]


class MockResult(MockModel):
    COLUMNS = [
        "id",
        "component",
        "data",
        "duration",
        "env",
        "params",
        "project_id",
        "result",
        "run_id",
        "source",
        "start_time",
        "test_id",
        "project",
    ]


class MockReport(MockModel):
    COLUMNS = [
        "id",
        "created",
        "download_url",
        "filename",
        "mimetype",
        "name",
        "params",
        "project_id",
        "status",
        "url",
        "view_url",
    ]


class MockRun(MockModel):
    COLUMNS = [
        "id",
        "component",
        "created",
        "data",
        "duration",
        "env",
        "project_id",
        "source",
        "start_time",
        "summary",
        "project",
    ]


class MockDashboard(MockModel):
    COLUMNS = []


class MockWidgetConfig(MockModel):
    COLUMNS = [
        "id",
        "navigable",
        "params",
        "project_id",
        "dashboard_id",
        "title",
        "type",
        "weight",
        "widget",
        "project",
        "dashboard",
    ]


class MockUser(MockModel):
    COLUMNS = ["id", "email", "password", "name", "group_id", "is_superadmin"]

    def check_password(self, plain):
        self._test_password = plain
        return self.password == plain


# Mock out the task decorator
ibutsu_server.tasks.task = mock_task
