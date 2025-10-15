"""Tests for compare_runs_view widget"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.widgets.compare_runs_view import get_comparison_data


@pytest.fixture
def mock_results():
    """Mock results for comparison"""
    run_id_1 = str(uuid.uuid4())
    run_id_2 = str(uuid.uuid4())
    result_id_1 = str(uuid.uuid4())
    result_id_2 = str(uuid.uuid4())
    result_id_3 = str(uuid.uuid4())

    result1_obj = MagicMock()
    result1_obj.run_id = run_id_1
    result1_obj.start_time = MagicMock()
    result1_obj.data = {"fspath": "/path/to/test1.py"}

    def result1_to_dict():
        return {
            "id": result_id_1,
            "run_id": run_id_1,
            "test_id": "test1",
            "result": "passed",
            "metadata": {"fspath": "/path/to/test1.py"},
        }

    result1_obj.to_dict = result1_to_dict

    result2_obj = MagicMock()
    result2_obj.run_id = run_id_2
    result2_obj.start_time = MagicMock()
    result2_obj.data = {"fspath": "/path/to/test1.py"}

    def result2_to_dict():
        return {
            "id": result_id_2,
            "run_id": run_id_2,
            "test_id": "test1",
            "result": "failed",
            "metadata": {"fspath": "/path/to/test1.py"},
        }

    result2_obj.to_dict = result2_to_dict

    result3_obj = MagicMock()
    result3_obj.run_id = run_id_1
    result3_obj.start_time = MagicMock()
    result3_obj.data = {"fspath": "/path/to/test2.py"}

    def result3_to_dict():
        return {
            "id": result_id_3,
            "run_id": run_id_1,
            "test_id": "test2",
            "result": "passed",
            "metadata": {"fspath": "/path/to/test2.py"},
        }

    result3_obj.to_dict = result3_to_dict

    return [result1_obj, result2_obj, result3_obj]


@pytest.mark.skip(
    reason="Complex query mocking with multiple filter chains - requires integration test"
)
def test_get_comparison_data_with_different_results(mock_results):
    """Test getting comparison data with different results"""
    additional_filters = ["env=production", "env=staging"]

    with (
        patch("ibutsu_server.widgets.compare_runs_view.Result") as mock_result_class,
        patch("ibutsu_server.widgets.compare_runs_view.convert_filter") as mock_convert_filter,
    ):
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()

        # Set up the query chain
        mock_result_class.query = mock_query1
        mock_query1.filter.return_value = mock_query1
        mock_query1.with_entities.return_value = mock_query1
        mock_query1.order_by.return_value = mock_query1
        mock_query1.first.return_value = (str(uuid.uuid4()),)

        mock_query2.filter.return_value = mock_query2
        mock_query2.with_entities.return_value = mock_query2
        mock_query2.order_by.return_value = mock_query2
        mock_query2.first.return_value = (str(uuid.uuid4()),)

        # Mock the all() to return results
        mock_query1.all.return_value = [mock_results[0], mock_results[2]]
        mock_query2.all.return_value = [mock_results[1]]

        mock_convert_filter.return_value = MagicMock()

        result = get_comparison_data(additional_filters)

        assert result is not None
        assert "results" in result
        assert "pagination" in result
        assert result["pagination"]["totalItems"] == 1


def test_get_comparison_data_no_filters():
    """Test getting comparison data with no filters"""
    with patch("ibutsu_server.widgets.compare_runs_view.Result") as mock_result_class:
        mock_query = MagicMock()
        mock_result_class.query = mock_query
        mock_query.with_entities.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.first.return_value = None

        result = get_comparison_data(additional_filters=None)

        assert result is not None
        assert "results" in result
        assert "pagination" in result


def test_get_comparison_data_empty_results():
    """Test getting comparison data with no matching results"""
    additional_filters = ["env=production", "env=staging"]

    with (
        patch("ibutsu_server.widgets.compare_runs_view.Result") as mock_result_class,
        patch("ibutsu_server.widgets.compare_runs_view.convert_filter") as mock_convert_filter,
    ):
        mock_query = MagicMock()
        mock_result_class.query = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.with_entities.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.first.return_value = (str(uuid.uuid4()),)
        mock_query.all.return_value = []

        mock_convert_filter.return_value = MagicMock()

        result = get_comparison_data(additional_filters)

        assert result is not None
        assert "results" in result
        assert len(result["results"]) == 0
        assert result["pagination"]["totalItems"] == 0


@pytest.mark.skip(
    reason="Complex query mocking with multiple filter chains - requires integration test"
)
def test_get_comparison_data_matching_results():
    """Test getting comparison data with matching test IDs but different results"""
    additional_filters = ["env=production", "env=staging"]

    run_id_1 = str(uuid.uuid4())
    run_id_2 = str(uuid.uuid4())
    result_id_1 = str(uuid.uuid4())
    result_id_2 = str(uuid.uuid4())

    result1_obj = MagicMock()
    result1_obj.run_id = run_id_1

    def result1_to_dict():
        return {
            "id": result_id_1,
            "run_id": run_id_1,
            "test_id": "test::path",
            "result": "passed",
            "metadata": {"fspath": "/test.py"},
        }

    result1_obj.to_dict = result1_to_dict

    result2_obj = MagicMock()
    result2_obj.run_id = run_id_2

    def result2_to_dict():
        return {
            "id": result_id_2,
            "run_id": run_id_2,
            "test_id": "test::path",
            "result": "failed",
            "metadata": {"fspath": "/test.py"},
        }

    result2_obj.to_dict = result2_to_dict

    with (
        patch("ibutsu_server.widgets.compare_runs_view.Result") as mock_result_class,
        patch("ibutsu_server.widgets.compare_runs_view.convert_filter") as mock_convert_filter,
    ):
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()

        mock_result_class.query = mock_query1
        mock_query1.filter.return_value = mock_query1
        mock_query1.with_entities.return_value = mock_query1
        mock_query1.order_by.return_value = mock_query1
        mock_query1.first.return_value = (run_id_1,)
        mock_query1.all.return_value = [result1_obj]

        mock_query2.filter.return_value = mock_query2
        mock_query2.with_entities.return_value = mock_query2
        mock_query2.order_by.return_value = mock_query2
        mock_query2.first.return_value = (run_id_2,)
        mock_query2.all.return_value = [result2_obj]

        mock_convert_filter.return_value = MagicMock()

        result = get_comparison_data(additional_filters)

        assert result is not None
        assert "results" in result
        assert result["pagination"]["totalItems"] == 1
