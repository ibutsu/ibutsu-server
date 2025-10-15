from unittest.mock import patch

import pytest
from flask import json

from tests.conftest import MOCK_PROJECT_ID, MOCK_WIDGET_CONFIG_ID
from tests.test_util import MockWidgetConfig


@pytest.fixture
def widget_config_controller_mocks():
    """Mocks for the widget config controller tests"""
    with (
        patch(
            "ibutsu_server.controllers.widget_config_controller.WidgetConfig"
        ) as mock_widget_config_class,
        patch("ibutsu_server.controllers.widget_config_controller.session") as mock_session,
    ):
        mock_widget_config = MockWidgetConfig(id=MOCK_WIDGET_CONFIG_ID, project_id=MOCK_PROJECT_ID)
        mock_widget_config_class.query.filter.return_value.all.return_value = [mock_widget_config]
        mock_widget_config_class.query.get.return_value = mock_widget_config
        mock_widget_config_class.from_dict.return_value = mock_widget_config
        yield {
            "widget_config_class": mock_widget_config_class,
            "session": mock_session,
            "widget_config": mock_widget_config,
        }


def test_get_widget_config_list(widget_config_controller_mocks, flask_app):
    """Test get_widget_config_list"""
    client, jwt_token = flask_app

    headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

    response = client.get(f"/api/widget-config?project_id={MOCK_PROJECT_ID}", headers=headers)

    assert response.status_code == 200
    json_response = response.json
    assert isinstance(json_response, list)
    assert len(json_response) == 1
    assert json_response[0]["id"] == MOCK_WIDGET_CONFIG_ID


def test_add_widget_config(widget_config_controller_mocks, flask_app):
    """Test add_widget_config"""
    client, jwt_token = flask_app
    mocks = widget_config_controller_mocks
    widget_config_data = {
        "widget": "my-widget",
        "project_id": MOCK_PROJECT_ID,
        "data": {"config_key": "config_value"},
        "title": "My Widget",
    }

    headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

    response = client.post(
        "/api/widget-config", headers=headers, data=json.dumps(widget_config_data)
    )

    assert response.status_code == 201
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()


def test_get_widget_config(widget_config_controller_mocks, flask_app):
    """Test case for get_widget_config"""
    client, jwt_token = flask_app
    headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
    response = client.get(f"/api/widget-config/{MOCK_WIDGET_CONFIG_ID}", headers=headers)
    assert response.status_code == 200
    assert response.json["id"] == MOCK_WIDGET_CONFIG_ID


def test_update_widget_config(widget_config_controller_mocks, flask_app):
    """Test case for update_widget_config"""
    client, jwt_token = flask_app
    mocks = widget_config_controller_mocks
    body = {
        "widget": "run-aggregator",
        "project_id": MOCK_PROJECT_ID,
        "data": {"group_field": "component"},
        "title": "Run Aggregator",
        "weight": 3,
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/widget-config/{MOCK_WIDGET_CONFIG_ID}",
        headers=headers,
        data=json.dumps(body),
    )
    assert response.status_code == 200
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()


def test_delete_widget_config(widget_config_controller_mocks, flask_app):
    """Test case for delete_widget_config"""
    client, jwt_token = flask_app
    mocks = widget_config_controller_mocks
    headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
    response = client.delete(f"/api/widget-config/{MOCK_WIDGET_CONFIG_ID}", headers=headers)
    assert response.status_code == 204
    mocks["session"].delete.assert_called_once()
    mocks["session"].commit.assert_called_once()
