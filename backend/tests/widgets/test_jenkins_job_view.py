"""Tests for jenkins_job_view widget"""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view


@pytest.fixture
def mock_jenkins_jobs():
    """Mock jenkins jobs data"""
    return {
        "jobs": [
            {
                "_id": "job1-100",
                "build_number": "100",
                "build_url": "http://jenkins/job/job1/100",
                "duration": 300.0,
                "env": "production",
                "job_name": "job1",
                "source": "jenkins",
                "start_time": datetime.now(timezone.utc),
                "summary": {
                    "xfailures": 0,
                    "xpasses": 0,
                    "errors": 0,
                    "failures": 2,
                    "skips": 5,
                    "tests": 100,
                    "passes": 93,
                },
                "total_execution_time": 250.0,
            }
        ],
        "pagination": {"page": 1, "pageSize": 25, "totalItems": 1},
    }


def test_get_jenkins_job_view_default_parameters(mock_jenkins_jobs):
    """Test getting jenkins job view with default parameters"""
    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view()

        assert result is not None
        assert "jobs" in result
        assert "pagination" in result
        assert result["pagination"]["totalPages"] == 1


def test_get_jenkins_job_view_with_string_filters(mock_jenkins_jobs):
    """Test getting jenkins job view with string filters"""
    filters = "env=production,job_name=test-job"

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(additional_filters=filters)

        assert result is not None
        assert "jobs" in result
        mock_aggregation.assert_called_once()
        call_args = mock_aggregation.call_args[0]
        assert isinstance(call_args[0], list)
        assert "env=production" in call_args[0]


def test_get_jenkins_job_view_with_list_filters(mock_jenkins_jobs):
    """Test getting jenkins job view with list filters"""
    filters = ["env=production", "job_name=test-job"]

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(additional_filters=filters)

        assert result is not None
        assert "jobs" in result
        mock_aggregation.assert_called_once()


def test_get_jenkins_job_view_with_project(mock_jenkins_jobs):
    """Test getting jenkins job view with project filter"""
    project_id = str(uuid.uuid4())

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(project=project_id)

        assert result is not None
        mock_aggregation.assert_called_with([], project_id, 1, 25, None)


def test_get_jenkins_job_view_with_pagination(mock_jenkins_jobs):
    """Test getting jenkins job view with pagination"""
    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(page=2, page_size=50)

        assert result is not None
        mock_aggregation.assert_called_with([], None, 2, 50, None)


def test_get_jenkins_job_view_with_run_limit(mock_jenkins_jobs):
    """Test getting jenkins job view with run limit"""
    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(run_limit=1000)

        assert result is not None
        mock_aggregation.assert_called_with([], None, 1, 25, 1000)


def test_get_jenkins_job_view_pagination_calculation():
    """Test pagination calculation with different page sizes"""
    jobs_data = {
        "jobs": [],
        "pagination": {"page": 1, "pageSize": 25, "totalItems": 76},
    }

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = jobs_data

        result = get_jenkins_job_view()

        assert result is not None
        assert result["pagination"]["totalPages"] == 4


def test_get_jenkins_job_view_pagination_exact_page():
    """Test pagination calculation with exact page division"""
    jobs_data = {
        "jobs": [],
        "pagination": {"page": 1, "pageSize": 25, "totalItems": 75},
    }

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = jobs_data

        result = get_jenkins_job_view()

        assert result is not None
        assert result["pagination"]["totalPages"] == 3


def test_get_jenkins_job_view_empty_results():
    """Test getting jenkins job view with no results"""
    jobs_data = {
        "jobs": [],
        "pagination": {"page": 1, "pageSize": 25, "totalItems": 0},
    }

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = jobs_data

        result = get_jenkins_job_view()

        assert result is not None
        assert len(result["jobs"]) == 0
        assert result["pagination"]["totalPages"] == 0


def test_get_jenkins_job_view_all_parameters(mock_jenkins_jobs):
    """Test getting jenkins job view with all parameters"""
    filters = ["env=production"]
    project_id = str(uuid.uuid4())

    with patch(
        "ibutsu_server.widgets.jenkins_job_view._get_jenkins_aggregation"
    ) as mock_aggregation:
        mock_aggregation.return_value = mock_jenkins_jobs

        result = get_jenkins_job_view(
            additional_filters=filters, project=project_id, page=2, page_size=50, run_limit=1000
        )

        assert result is not None
        mock_aggregation.assert_called_with(filters, project_id, 2, 50, 1000)
