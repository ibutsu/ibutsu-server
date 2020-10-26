import logging
from copy import copy
from inspect import isfunction

import ibutsu_server.tasks
from flask_testing import TestCase
from ibutsu_server import get_app
from ibutsu_server.tasks import create_celery_app
from ibutsu_server.util import merge_dicts


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
        }
        app = get_app(**extra_config)
        create_celery_app(app.app)

        if ibutsu_server.tasks.task is None:
            ibutsu_server.tasks.task = mock_task
        return app.app

    def assert_201(self, response, message=None):
        """
        Checks if response status code is 201
        :param response: Flask response
        :param message: Message to display on test failure
        """
        self.assert_status(response, 201, message)

    def assert_equal(self, first, second, msg=None):
        """Alias"""
        return self.assertEqual(first, second, msg)

    def assert_not_equal(self, first, second, msg=None):
        """Alias"""
        return self.assertNotEqual(first, second, msg)


class MockModel(object):
    """Mock model object"""

    COLUMNS = ["id"]

    def __init__(self, **fields):
        for column in self.COLUMNS:
            if column in fields.keys():
                setattr(self, column, fields[column])
            else:
                setattr(self, column, None)

    def to_dict(self):
        record_dict = copy(self.__dict__)
        # when outputting info, translate data to metadata
        if record_dict.get("data"):
            record_dict["metadata"] = record_dict.pop("data")
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
    COLUMNS = ["id", "filename", "result_id", "data", "content"]


class MockGroup(MockModel):
    COLUMNS = ["id", "name", "data"]


class MockImport(MockModel):
    COLUMNS = ["id", "filename", "format", "data", "status"]


class MockProject(MockModel):
    COLUMNS = ["id", "name", "title", "owner_id", "group_id"]


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
    ]


# Mock out the task decorator
ibutsu_server.tasks.task = mock_task
