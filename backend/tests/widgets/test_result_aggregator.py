from unittest.mock import MagicMock, patch

from ibutsu_server.widgets.result_aggregator import get_recent_result_data

MOCK_DAYS = 7
MOCK_GROUP_FIELD = "component"
MOCK_PROJECT_ID = "test-project-id"
MOCK_RUN_ID = "test-run-id"


@patch("ibutsu_server.widgets.result_aggregator.session")
@patch("ibutsu_server.widgets.result_aggregator.apply_filters")
@patch("ibutsu_server.widgets.result_aggregator.string_to_column")
def test_get_recent_result_data(mock_string_to_column, mock_apply_filters, mock_session):
    """Test the get_recent_result_data function."""
    mock_query = MagicMock()
    mock_session.query.return_value.group_by.return_value.order_by.return_value = mock_query
    mock_apply_filters.return_value = mock_query
    mock_query.all.return_value = [("component1", 10), ("component2", 20)]

    result = get_recent_result_data(
        MOCK_GROUP_FIELD, MOCK_DAYS, MOCK_PROJECT_ID, run_id=MOCK_RUN_ID
    )

    assert len(result) == 2
    assert result[0] == {"_id": "component1", "count": 10}
    assert result[1] == {"_id": "component2", "count": 20}
    mock_string_to_column.assert_called_once()
    mock_apply_filters.assert_called_once()
    mock_session.query.assert_called_once()
