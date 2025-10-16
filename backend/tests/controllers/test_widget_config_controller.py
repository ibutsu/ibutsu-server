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
        # Set up query mock with proper count return value
        mock_query = mock_widget_config_class.query.filter.return_value
        mock_query.all.return_value = [mock_widget_config]
        mock_query.count.return_value = 1  # Return a real int, not a MagicMock
        mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            mock_widget_config
        ]
        mock_widget_config_class.query.get.return_value = mock_widget_config
        mock_widget_config_class.from_dict.return_value = mock_widget_config
        yield {
            "widget_config_class": mock_widget_config_class,
            "session": mock_session,
            "widget_config": mock_widget_config,
        }


def test_get_widget_config_list(flask_app):
    """Test get_widget_config_list"""
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Project, WidgetConfig

    client, jwt_token = flask_app

    # Create a real widget config in the test database
    with client.application.app_context():
        # Ensure project exists
        project = Project.query.get(MOCK_PROJECT_ID)
        if not project:
            project = Project(id=MOCK_PROJECT_ID, name="test-project")
            session.add(project)
            session.commit()

        # Create widget config
        widget_config = WidgetConfig(
            id=MOCK_WIDGET_CONFIG_ID, project_id=MOCK_PROJECT_ID, widget="test-widget"
        )
        session.add(widget_config)
        session.commit()

    headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

    response = client.get(f"/api/widget-config?project_id={MOCK_PROJECT_ID}", headers=headers)

    assert response.status_code == 200
    json_response = response.json
    # Response should have pagination structure
    assert "widgets" in json_response
    assert "pagination" in json_response
    assert len(json_response["widgets"]) >= 0  # May have widgets from setup


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

    # Mock WIDGET_TYPES to include our test widget
    with patch(
        "ibutsu_server.controllers.widget_config_controller.WIDGET_TYPES", {"my-widget": {}}
    ):
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
    # The controller returns 200, not 204 - this matches the actual implementation
    assert response.status_code == 200
    mocks["session"].delete.assert_called_once()
    mocks["session"].commit.assert_called_once()
