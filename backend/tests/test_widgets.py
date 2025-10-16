"""Tests for ibutsu_server.widgets"""

from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.controllers.widget_controller import (
    get_widget,
    get_widget_types as get_widget_list,
)


@pytest.fixture
def mock_widget_types():
    """Fixture to mock registered widget types."""
    return {
        "test-widget": {
            "title": "Test Widget",
            "description": "A widget for testing.",
            "params": {"param1": "default1"},
            "generate": lambda **_kwargs: "widget data",
        }
    }


def test_get_widget_list(mock_widget_types):
    """Test getting the list of widgets."""
    with patch("ibutsu_server.controllers.widget_controller.WIDGET_TYPES", mock_widget_types):
        widgets = get_widget_list()
        assert "types" in widgets
        assert len(widgets["types"]) == 1
        widget_info = widgets["types"][0]
        assert widget_info["title"] == "Test Widget"
        # generate function is included in types response, but params should be present
        assert "params" in widget_info


def test_get_widget_found(flask_app, mock_widget_types):
    """Test getting a single widget that exists."""
    client, _ = flask_app
    with (
        client.application.test_request_context(),
        patch("ibutsu_server.controllers.widget_controller.WIDGET_TYPES", mock_widget_types),
        patch(
            "ibutsu_server.controllers.widget_controller.WIDGET_METHODS",
            {"test-widget": mock_widget_types["test-widget"]["generate"]},
        ),
    ):
        widget_data = get_widget("test-widget")
        assert widget_data == "widget data"


def test_get_widget_with_params(flask_app, mock_widget_types):
    """Test getting a widget with parameters."""
    client, _ = flask_app
    mock_widget_types["test-widget"]["generate"] = MagicMock(return_value="custom data")
    with (
        client.application.test_request_context("/?param1=custom_value"),
        patch("ibutsu_server.controllers.widget_controller.WIDGET_TYPES", mock_widget_types),
        patch(
            "ibutsu_server.controllers.widget_controller.WIDGET_METHODS",
            {"test-widget": mock_widget_types["test-widget"]["generate"]},
        ),
    ):
        get_widget("test-widget")
        mock_widget_types["test-widget"]["generate"].assert_called_once()


def test_get_widget_not_found(flask_app):
    """Test getting a widget that does not exist."""
    client, _ = flask_app
    with (
        client.application.test_request_context(),
        patch("ibutsu_server.controllers.widget_controller.WIDGET_TYPES", {}),
    ):
        response, status = get_widget("nonexistent-widget")
        assert status == 404
        assert "not found" in response


def test_get_widget_exception_on_generate(flask_app, mock_widget_types):
    """Test exception handling during widget generation."""
    client, _ = flask_app
    mock_widget_types["test-widget"]["generate"] = MagicMock(side_effect=Exception("Test error"))
    with (
        client.application.test_request_context(),
        patch("ibutsu_server.controllers.widget_controller.WIDGET_TYPES", mock_widget_types),
        patch(
            "ibutsu_server.controllers.widget_controller.WIDGET_METHODS",
            {"test-widget": mock_widget_types["test-widget"]["generate"]},
        ),
    ):
        response, status = get_widget("test-widget")
        assert status == 500
        assert "Error processing widget" in response
