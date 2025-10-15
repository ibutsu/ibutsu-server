import uuid
from datetime import datetime
from io import BytesIO
from unittest import skip
from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_RUN_ID
from tests.test_util import MockProject, MockRun

START_TIME = datetime.utcnow()
MOCK_PROJECT_ID = str(uuid.uuid4())
MOCK_USER_ID = str(uuid.uuid4())
MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID, name="my-project", title="My Project", owner_id=MOCK_USER_ID
)
MOCK_RUN = MockRun(
    id=MOCK_RUN_ID,
    summary={"errors": 1, "failures": 3, "skips": 0, "tests": 548},
    duration=540.05433,
    data={"component": "test-component", "env": "local", "project": MOCK_PROJECT.id},
    env="local",
    component="test-component",
    start_time=str(START_TIME),
    created=str(START_TIME),
)
MOCK_RUN_DICT = MOCK_RUN.to_dict()


@pytest.fixture
def run_controller_mocks():
    """Mocks for the run controller tests"""
    mock_limit = MagicMock()
    mock_limit.return_value.offset.return_value.all.return_value = [MOCK_RUN]
    with (
        patch("ibutsu_server.controllers.run_controller.session") as mock_session,
        patch("ibutsu_server.controllers.run_controller.project_has_user") as mock_project_has_user,
        patch("ibutsu_server.controllers.run_controller.Run") as mock_run_class,
        patch("ibutsu_server.controllers.run_controller.add_user_filter") as mock_add_user_filter,
        patch("ibutsu_server.controllers.run_controller.update_run_task") as mock_update_run_task,
    ):
        mock_project_has_user.return_value = True
        mock_run_class.query.get.return_value = MOCK_RUN
        mock_run_class.from_dict.return_value = MOCK_RUN
        mock_add_user_filter.return_value.count.return_value = 1
        mock_add_user_filter.return_value.limit = mock_limit

        yield {
            "session": mock_session,
            "project_has_user": mock_project_has_user,
            "run_class": mock_run_class,
            "add_user_filter": mock_add_user_filter,
            "update_run_task": mock_update_run_task,
        }


def test_add_run(flask_app, run_controller_mocks):
    """Test case for add_run"""
    client, jwt_token = flask_app
    mocks = run_controller_mocks
    with patch("ibutsu_server.util.projects.Project") as mock_project_class:
        mock_project_class.query.get.return_value = MOCK_PROJECT
        mock_project_class.from_dict.return_value = MOCK_PROJECT
        run_dict = {
            "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
            "duration": 540.05433,
            "metadata": {
                "component": "test-component",
                "env": "local",
                "project": MOCK_PROJECT.id,
            },
            "start_time": START_TIME,
            "created": START_TIME,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            "/api/run",
            method="POST",
            headers=headers,
            data=json.dumps(run_dict),
            content_type="application/json",
        )
        assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
        resp = response.json.copy()
        resp["project"] = None
        assert resp == MOCK_RUN_DICT
        mocks["update_run_task"].apply_async.assert_called_once_with((MOCK_RUN_ID,), countdown=5)


def test_get_run(flask_app, run_controller_mocks):
    """Test case for get_run"""
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(f"/api/run/{MOCK_RUN_ID}", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    resp = response.json.copy()
    resp["project"] = None
    assert resp == MOCK_RUN_DICT


def test_get_run_list(flask_app, run_controller_mocks):
    """Test case for get_run_list"""
    client, jwt_token = flask_app
    query_string = [("page", 56), ("pageSize", 56)]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open("/api/run", method="GET", headers=headers, query_string=query_string)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


@skip("multipart/form-data not supported by Connexion")
def test_import_run(flask_app, run_controller_mocks):
    """Test case for import_run"""
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Content-Type": "multipart/form-data",
        "Authorization": f"Bearer {jwt_token}",
    }
    data = {"xml_file": (BytesIO(b"some file data"), "file.txt")}
    response = client.open(
        "/api/run/import",
        method="POST",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_update_run(flask_app, run_controller_mocks):
    """Test case for update_run"""
    client, jwt_token = flask_app
    mocks = run_controller_mocks
    run_dict = {
        "duration": 540.05433,
        "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/run/{MOCK_RUN_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps(run_dict),
        content_type="application/json",
    )
    mocks["update_run_task"].apply_async.assert_called_once_with((MOCK_RUN_ID,), countdown=5)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    resp = response.json.copy()
    resp["project"] = None
    assert resp == MOCK_RUN_DICT
