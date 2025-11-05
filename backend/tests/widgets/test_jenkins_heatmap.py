from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.widgets.jenkins_heatmap import (
    _calculate_slope,
    _get_builds,
    _get_heatmap,
    _pad_heatmap,
    get_jenkins_heatmap,
)

MOCK_JOB_NAME = "test-job"
MOCK_BUILDS = 5
MOCK_PROJECT_ID = "test-project"
MOCK_GROUP_FIELD = "component"


@pytest.mark.parametrize(
    ("x_data", "expected_slope"),
    [
        ([100, 100, 100], 100),
        ([90, 80, 70], -0.1),  # Linear regression slope per unit
        ([70, 80, 90], 0.1),  # Linear regression slope per unit
        ([80, 80, 80], 0),
    ],
)
def test_calculate_slope(x_data, expected_slope):
    """Test the _calculate_slope function."""
    assert _calculate_slope(x_data) == expected_slope


@patch("ibutsu_server.widgets.jenkins_heatmap.session")
@patch("ibutsu_server.widgets.jenkins_heatmap.apply_filters")
def test_get_builds(mock_apply_filters, mock_session, app_context):
    """Test the _get_builds function."""
    mock_query = MagicMock()
    order_by_mock = mock_query
    (
        mock_session.query.return_value.select_entity_from.return_value.group_by.return_value.order_by.return_value
    ) = order_by_mock
    mock_apply_filters.return_value = mock_query
    min_start_time, builds = _get_builds(MOCK_JOB_NAME, MOCK_BUILDS, MOCK_PROJECT_ID)
    assert min_start_time is None
    assert builds == []


@patch("ibutsu_server.widgets.jenkins_heatmap._get_builds")
@patch("ibutsu_server.widgets.jenkins_heatmap.string_to_column")
def test_get_heatmap(mock_string_to_column, mock_get_builds, app_context):
    """Test the _get_heatmap function handles None group_field."""
    # Test early return when string_to_column returns None
    mock_string_to_column.return_value = None
    mock_get_builds.return_value = (None, [])

    heatmap, builds = _get_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, True, MOCK_PROJECT_ID
    )
    assert heatmap == {}
    assert builds == []


def test_pad_heatmap():
    """Test the _pad_heatmap function."""
    heatmap = {"component1": [[-10.0, 0], [90, "run1", None, "1"], [70, "run3", None, "3"]]}
    builds_in_db = ["1", "2", "3"]
    padded_heatmap = _pad_heatmap(heatmap, builds_in_db)
    assert len(padded_heatmap["component1"]) == 4
    assert padded_heatmap["component1"][2][0] == "Build failed"


@patch("ibutsu_server.widgets.jenkins_heatmap._get_heatmap")
@patch("ibutsu_server.widgets.jenkins_heatmap._pad_heatmap")
def test_get_jenkins_heatmap(mock_pad_heatmap, mock_get_heatmap):
    """Test the get_jenkins_heatmap function."""
    mock_get_heatmap.return_value = ({}, [])
    mock_pad_heatmap.return_value = {}
    result = get_jenkins_heatmap(MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD)
    assert result == {"heatmap": {}}
