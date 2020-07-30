import logging
from unittest.mock import MagicMock

import ibutsu_server.tasks
from flask_testing import TestCase
from ibutsu_server import get_app
from ibutsu_server.tasks import create_celery_app


class BaseTestCase(TestCase):
    def create_app(self):
        logging.getLogger("connexion.operation").setLevel("ERROR")
        extra_config = {
            "TESTING": True,
            "LIVESERVER_PORT": 0,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
        }
        app = get_app(**extra_config)
        create_celery_app(app.app)
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

    def __init__(self, id_=None, data=None, content=None):
        self.id = id_
        self.data = data
        self.content = content

    def get(self, key, default=None):
        return self.data.get(key, default)

    def to_dict(self):
        return_dict = {"id": self.id}
        if self.data:
            return_dict.update(self.data)
        return return_dict

    @classmethod
    def from_dict(cls, new_dict):
        return cls(data=new_dict)

    def update(self, updated_dict):
        self.data.update(updated_dict)


# Mock out the task decorator
ibutsu_server.tasks.task = MagicMock()
