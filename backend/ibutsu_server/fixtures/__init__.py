import logging

import connexion
import pytest
from ibutsu_server.encoder import JSONEncoder


@pytest.fixture(scope="session", autouse=True)
def create_app():
    logging.getLogger("connexion.operation").setLevel("ERROR")
    app = connexion.App(__name__, specification_dir="../openapi/")
    app.app.json_encoder = JSONEncoder
    app.add_api("openapi.yaml")
    return app.app
