from unittest.mock import patch

import pytest

from ibutsu_server.widgets.jenkins_job_analysis import (
    get_jenkins_analysis_data,
    get_jenkins_bar_chart,
    get_jenkins_line_chart,
)

MOCK_JOB_NAME = "test-job"
MOCK_BUILDS = 10
MOCK_PROJECT_ID = "test-project"


@pytest.fixture
def mock_get_jenkins_job_view():
    """Mock the get_jenkins_job_view function."""
    with patch("ibutsu_server.widgets.jenkins_job_analysis.get_jenkins_job_view") as mock_get_jjv:
        yield mock_get_jjv


def test_get_jenkins_line_chart(mock_get_jenkins_job_view):
    """Test the get_jenkins_line_chart function."""
    # Mock data with different duration and total_execution_time
    mock_get_jenkins_job_view.return_value = {
        "jobs": [
            {
                "build_number": "1",
                "duration": 3600,
                "total_execution_time": 7200,
            },
            {
                "build_number": "2",
                "duration": 1800,
                "total_execution_time": 1800,
            },
        ]
    }

    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=MOCK_PROJECT_ID)

    assert "duration" in result
    assert "total_execution_time" in result
    assert result["duration"] == {"1": 1.0, "2": 0.5}
    assert result["total_execution_time"] == {"1": 2.0, "2": 0.5}
    mock_get_jenkins_job_view.assert_called_once()


def test_get_jenkins_bar_chart(mock_get_jenkins_job_view):
    """Test the get_jenkins_bar_chart function."""
    mock_get_jenkins_job_view.return_value = {
        "jobs": [
            {
                "build_number": "1",
                "summary": {
                    "passes": 10,
                    "skips": 1,
                    "errors": 2,
                    "failures": 3,
                    "xfailures": 4,
                    "xpasses": 5,
                },
            }
        ]
    }

    result = get_jenkins_bar_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=MOCK_PROJECT_ID)

    assert result["passed"] == {"1": 10}
    assert result["skipped"] == {"1": 1}
    assert result["error"] == {"1": 2}
    assert result["failed"] == {"1": 3}
    assert result["xfailed"] == {"1": 4}
    assert result["xpassed"] == {"1": 5}
    mock_get_jenkins_job_view.assert_called_once()


def test_get_jenkins_analysis_data():
    """Test the get_jenkins_analysis_data function."""
    result = get_jenkins_analysis_data(MOCK_JOB_NAME, MOCK_BUILDS, project=MOCK_PROJECT_ID)

    assert "barchart_params" in result
    assert "heatmap_params" in result
    assert "linechart_params" in result
    assert result["barchart_params"] == {
        "job_name": MOCK_JOB_NAME,
        "builds": MOCK_BUILDS,
        "project": MOCK_PROJECT_ID,
    }
    assert result["heatmap_params"]["builds"] <= MOCK_BUILDS
