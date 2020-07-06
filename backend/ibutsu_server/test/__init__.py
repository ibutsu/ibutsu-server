import logging

import connexion
from flask_testing import TestCase
from ibutsu_server.encoder import JSONEncoder


class BaseTestCase(TestCase):
    def create_app(self):
        logging.getLogger("connexion.operation").setLevel("ERROR")
        app = connexion.App(__name__, specification_dir="../openapi/")
        app.app.json_encoder = JSONEncoder
        app.add_api("openapi.yaml", pythonic_params=True)
        return app.app

    def assert_201(self, response, message=None):
        """
        Checks if response status code is 201
        :param response: Flask response
        :param message: Message to display on test failure
        """
        self.assert_status(response, 201, message)
