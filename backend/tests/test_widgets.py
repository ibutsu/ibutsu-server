"""Tests for ibutsu_server.widgets"""

from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.widgets import get_widget, get_widget_list


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
    with patch("ibutsu_server.widgets.WIDGET_TYPES", mock_widget_types):
        widgets = get_widget_list()
        assert "widgets" in widgets
        assert len(widgets["widgets"]) == 1
        widget_info = widgets["widgets"][0]
        assert widget_info["id"] == "test-widget"
        assert widget_info["title"] == "Test Widget"
        assert "generate" not in widget_info  # Ensure generate function is not exposed


def test_get_widget_found(mock_widget_types):
    """Test getting a single widget that exists."""
    with patch("ibutsu_server.widgets.WIDGET_TYPES", mock_widget_types):
        widget_data = get_widget("test-widget")
        assert widget_data == "widget data"


def test_get_widget_with_params(mock_widget_types):
    """Test getting a widget with parameters."""
    mock_widget_types["test-widget"]["generate"] = MagicMock(return_value="custom data")
    with patch("ibutsu_server.widgets.WIDGET_TYPES", mock_widget_types):
        get_widget("test-widget", param1="custom_value")
        mock_widget_types["test-widget"]["generate"].assert_called_once_with(param1="custom_value")


def test_get_widget_not_found():
    """Test getting a widget that does not exist."""
    with patch("ibutsu_server.widgets.WIDGET_TYPES", {}):
        response, status = get_widget("nonexistent-widget")
        assert status == 404
        assert "not found" in response["detail"]


def test_get_widget_exception_on_generate(mock_widget_types):
    """Test exception handling during widget generation."""
    mock_widget_types["test-widget"]["generate"] = MagicMock(side_effect=Exception("Test error"))
    with patch("ibutsu_server.widgets.WIDGET_TYPES", mock_widget_types):
        response, status = get_widget("test-widget")
        assert status == 500
        assert "Error generating widget" in response["detail"]
        assert "Test error" in response["detail"]
