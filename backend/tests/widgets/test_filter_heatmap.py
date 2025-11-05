from unittest.mock import patch

from ibutsu_server.widgets.filter_heatmap import get_filter_heatmap

MOCK_FILTERS = "component=filter-component"
MOCK_BUILDS = 5
MOCK_GROUP_FIELD = "component"
MOCK_PROJECT_ID = "test-project"


@patch("ibutsu_server.widgets.filter_heatmap.string_to_column")
def test_get_filter_heatmap(mock_string_to_column, app_context):
    """Test the get_filter_heatmap function handles None group_field."""
    # Test early return when string_to_column returns None
    mock_string_to_column.return_value = None

    result = get_filter_heatmap(MOCK_FILTERS, MOCK_BUILDS, MOCK_GROUP_FIELD, MOCK_PROJECT_ID)

    assert "heatmap" in result
    assert result["heatmap"] == {}
    mock_string_to_column.assert_called()
