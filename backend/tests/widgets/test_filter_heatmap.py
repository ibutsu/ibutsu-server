from unittest.mock import MagicMock, patch

from ibutsu_server.widgets.filter_heatmap import get_filter_heatmap

MOCK_FILTERS = "component=filter-component"
MOCK_BUILDS = 5
MOCK_GROUP_FIELD = "component"
MOCK_PROJECT_ID = "test-project"


@patch("ibutsu_server.widgets.filter_heatmap.session")
@patch("ibutsu_server.widgets.filter_heatmap.apply_filters")
@patch("ibutsu_server.widgets.filter_heatmap.string_to_column")
def test_get_filter_heatmap(mock_string_to_column, mock_apply_filters, mock_session, app_context):
    """Test the get_filter_heatmap function."""
    mock_query = MagicMock()
    subquery_mock = MagicMock()
    (
        mock_session.query.return_value.order_by.return_value.limit.return_value.subquery.return_value
    ) = subquery_mock
    subquery_c_mock = MagicMock()
    (
        mock_apply_filters.return_value.order_by.return_value.limit.return_value.subquery.return_value.c
    ) = subquery_c_mock
    group_by_mock = mock_query
    (
        mock_session.query.return_value.select_entity_from.return_value.order_by.return_value.group_by.return_value
    ) = group_by_mock
    mock_apply_filters.return_value = mock_query
    mock_query.subquery.return_value = MagicMock()

    result = get_filter_heatmap(MOCK_FILTERS, MOCK_BUILDS, MOCK_GROUP_FIELD, MOCK_PROJECT_ID)

    assert "heatmap" in result
    assert result["heatmap"] == {}
    mock_string_to_column.assert_called()
    mock_apply_filters.assert_called()
    mock_session.query.assert_called()
