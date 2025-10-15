from unittest.mock import MagicMock, patch

from ibutsu_server.widgets.run_aggregator import get_recent_run_data

MOCK_WEEKS = 4
MOCK_GROUP_FIELD = "component"
MOCK_PROJECT_ID = "test-project"


@patch("ibutsu_server.widgets.run_aggregator.session")
@patch("ibutsu_server.widgets.run_aggregator.apply_filters")
@patch("ibutsu_server.widgets.run_aggregator.string_to_column")
def test_get_recent_run_data(mock_string_to_column, mock_apply_filters, mock_session):
    """Test the get_recent_run_data function."""
    mock_query = MagicMock()
    mock_session.query.return_value.group_by.return_value = mock_query
    mock_apply_filters.return_value = mock_query
    mock_query.all.return_value = [
        ("component1", 10.0, 5.0, 2.0, 100.0, 1.0, 2.0),
        ("component2", 0.0, 0.0, 0.0, 50.0, 0.0, 0.0),
    ]

    result = get_recent_run_data(MOCK_WEEKS, MOCK_GROUP_FIELD, MOCK_PROJECT_ID)

    assert "passed" in result
    assert "component1" in result["passed"]
    assert "component2" in result["passed"]
    assert result["passed"]["component1"] == 80
    assert result["passed"]["component2"] == 100
    mock_string_to_column.assert_called_once()
    mock_apply_filters.assert_called_once()
    mock_session.query.assert_called_once()
