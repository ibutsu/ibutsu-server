"""Tests for accessibility_analysis widget"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
import yaml

from ibutsu_server.widgets.accessibility_analysis import (
    get_accessibility_analysis_view,
    get_accessibility_bar_chart,
)


@pytest.fixture
def mock_artifacts():
    """Mock artifacts with accessibility data"""
    artifact1 = MagicMock()
    artifact1.content = yaml.dump(
        {
            "passes": 85,
            "violations": 15,
            "timestamp": "2023-01-01T12:00:00",
        }
    )

    artifact2 = MagicMock()
    artifact2.content = yaml.dump(
        {
            "incomplete": 5,
            "timestamp": "2023-01-01T13:00:00",
        }
    )

    return [artifact1, artifact2]


@pytest.fixture
def mock_empty_artifacts():
    """Mock empty artifacts"""
    return []


def test_get_accessibility_bar_chart_success(mock_artifacts):
    """Test getting accessibility bar chart with valid data"""
    run_list = [str(uuid.uuid4()), str(uuid.uuid4())]

    with patch("ibutsu_server.widgets.accessibility_analysis.Artifact") as mock_artifact_class:
        mock_query = MagicMock()
        mock_query.all.return_value = mock_artifacts
        mock_artifact_class.query.filter.return_value = mock_query

        result = get_accessibility_bar_chart(run_list)

        assert result is not None
        assert len(result) == 3
        assert result[0]["x"] == "passes"
        assert result[0]["y"] == 85
        assert result[0]["ratio"] == 85.0
        assert result[1]["x"] == "violations"
        assert result[1]["y"] == 15
        assert result[1]["ratio"] == 15.0
        assert result[2]["total"] == 100


def test_get_accessibility_bar_chart_no_passes_data(mock_empty_artifacts):
    """Test getting accessibility bar chart with no passes data"""
    run_list = [str(uuid.uuid4())]

    artifact = MagicMock()
    artifact.content = yaml.dump({"incomplete": 5})
    mock_artifacts_no_passes = [artifact]

    with patch("ibutsu_server.widgets.accessibility_analysis.Artifact") as mock_artifact_class:
        mock_query = MagicMock()
        mock_query.all.return_value = mock_artifacts_no_passes
        mock_artifact_class.query.filter.return_value = mock_query

        result = get_accessibility_bar_chart(run_list)

        assert result is None


def test_get_accessibility_bar_chart_empty_artifacts():
    """Test getting accessibility bar chart with no artifacts"""
    run_list = [str(uuid.uuid4())]

    with patch("ibutsu_server.widgets.accessibility_analysis.Artifact") as mock_artifact_class:
        mock_query = MagicMock()
        mock_query.all.return_value = []
        mock_artifact_class.query.filter.return_value = mock_query

        result = get_accessibility_bar_chart(run_list)

        assert result is None


def test_get_accessibility_bar_chart_with_filters(mock_artifacts):
    """Test getting accessibility bar chart with filters"""
    run_list = [str(uuid.uuid4()), str(uuid.uuid4())]
    filters = {"env": "production"}

    with patch("ibutsu_server.widgets.accessibility_analysis.Artifact") as mock_artifact_class:
        mock_query = MagicMock()
        mock_query.all.return_value = mock_artifacts
        mock_artifact_class.query.filter.return_value = mock_query

        result = get_accessibility_bar_chart(run_list, filters)

        assert result is not None
        assert len(result) == 3


def test_get_accessibility_bar_chart_division_calculation():
    """Test the ratio calculation in accessibility bar chart"""
    run_list = [str(uuid.uuid4())]

    artifact = MagicMock()
    artifact.content = yaml.dump(
        {
            "passes": 73,
            "violations": 27,
        }
    )

    with patch("ibutsu_server.widgets.accessibility_analysis.Artifact") as mock_artifact_class:
        mock_query = MagicMock()
        mock_query.all.return_value = [artifact]
        mock_artifact_class.query.filter.return_value = mock_query

        result = get_accessibility_bar_chart(run_list)

        assert result is not None
        assert result[0]["ratio"] == 73.0
        assert result[1]["ratio"] == 27.0
        assert result[2]["total"] == 100


def test_get_accessibility_analysis_view():
    """Test getting accessibility analysis view"""
    run_list = [str(uuid.uuid4()), str(uuid.uuid4())]
    project = str(uuid.uuid4())

    result = get_accessibility_analysis_view(run_list, project)

    # This function currently just returns the run_list
    assert result == run_list
