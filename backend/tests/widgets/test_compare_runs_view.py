"""Tests for compare_runs_view widget"""

from datetime import datetime, timedelta, timezone

from ibutsu_server.widgets.compare_runs_view import get_comparison_data


def test_get_comparison_data_no_filters(db_session):
    """Test getting comparison data with no filters"""
    result = get_comparison_data(additional_filters=None)

    assert result is not None
    assert "results" in result
    assert "pagination" in result
    assert result["pagination"]["totalItems"] == 0
    assert len(result["results"]) == 0


def test_get_comparison_data_same_results(db_session, make_project, make_run, make_result):
    """Test getting comparison data when all results are the same (no differences)"""
    project = make_project()

    # Create two runs with different environments
    now = datetime.now(timezone.utc)
    run1 = make_run(
        project_id=project.id,
        metadata={"build": "100"},
        start_time=now - timedelta(hours=1),
    )
    run2 = make_run(
        project_id=project.id, metadata={"build": "101"}, start_time=now - timedelta(hours=2)
    )

    # Create identical results in both runs (both pass)
    # Note: env is a column on Result, fspath goes in metadata (becomes data column)
    make_result(
        run_id=run1.id,
        project_id=project.id,
        test_id="test1",
        result="passed",
        env="production",
        metadata={"fspath": "/path/to/test1.py"},
        start_time=now - timedelta(hours=1),
    )

    make_result(
        run_id=run2.id,
        project_id=project.id,
        test_id="test1",
        result="passed",
        env="staging",
        metadata={"fspath": "/path/to/test1.py"},
        start_time=now - timedelta(hours=2),
    )

    additional_filters = ["env=production", "env=staging"]
    result = get_comparison_data(additional_filters)

    assert result is not None
    assert "results" in result
    # No differences should be found since both tests passed
    assert len(result["results"]) == 0
    assert result["pagination"]["totalItems"] == 0


def test_get_comparison_data_with_different_results(
    db_session, make_project, make_run, make_result
):
    """Test getting comparison data with different results between runs"""
    project = make_project()

    # Create two runs with different environments and set start times
    now = datetime.now(timezone.utc)
    run1 = make_run(
        project_id=project.id,
        metadata={"build": "100"},
        start_time=now - timedelta(hours=1),
    )
    run2 = make_run(
        project_id=project.id, metadata={"build": "101"}, start_time=now - timedelta(hours=2)
    )

    # Create results for run1 (production)
    # Test1 passes in production
    make_result(
        run_id=run1.id,
        project_id=project.id,
        test_id="test1",
        result="passed",
        env="production",
        metadata={"fspath": "/path/to/test1.py"},
        start_time=now - timedelta(hours=1),
    )

    # Test2 passes in production (will not match as both pass)
    make_result(
        run_id=run1.id,
        project_id=project.id,
        test_id="test2",
        result="passed",
        env="production",
        metadata={"fspath": "/path/to/test2.py"},
        start_time=now - timedelta(hours=1),
    )

    # Create results for run2 (staging)
    # Test1 fails in staging (different result - should be included)
    make_result(
        run_id=run2.id,
        project_id=project.id,
        test_id="test1",
        result="failed",
        env="staging",
        metadata={"fspath": "/path/to/test1.py"},
        start_time=now - timedelta(hours=2),
    )

    # Test2 passes in staging (same as production - will not be included)
    make_result(
        run_id=run2.id,
        project_id=project.id,
        test_id="test2",
        result="passed",
        env="staging",
        metadata={"fspath": "/path/to/test2.py"},
        start_time=now - timedelta(hours=2),
    )

    additional_filters = ["env=production", "env=staging"]
    result = get_comparison_data(additional_filters)

    assert result is not None
    assert "results" in result
    assert "pagination" in result
    # Should find 1 difference: test1 passed in production but failed in staging
    assert result["pagination"]["totalItems"] == 1
    assert len(result["results"]) == 1

    # Verify the comparison contains the correct test
    comparison_pair = result["results"][0]
    result_prod, result_stag = comparison_pair
    assert result_prod["test_id"] == "test1"
    assert result_stag["test_id"] == "test1"
    assert result_prod["result"] == "passed"
    assert result_stag["result"] == "failed"
    assert result_prod["metadata"]["fspath"] == "/path/to/test1.py"
    assert result_stag["metadata"]["fspath"] == "/path/to/test1.py"


def test_get_comparison_data_matching_results(db_session, make_project, make_run, make_result):
    """Test getting comparison data with matching test IDs but different results"""
    project = make_project()

    # Create two runs with different environments
    now = datetime.now(timezone.utc)
    run1 = make_run(
        project_id=project.id,
        metadata={"build": "200"},
        start_time=now - timedelta(hours=1),
    )
    run2 = make_run(
        project_id=project.id, metadata={"build": "201"}, start_time=now - timedelta(hours=2)
    )

    # Create results with same test_id and fspath but different outcomes
    make_result(
        run_id=run1.id,
        project_id=project.id,
        test_id="test::path",
        result="passed",
        env="production",
        metadata={"fspath": "/test.py"},
        start_time=now - timedelta(hours=1),
    )

    make_result(
        run_id=run2.id,
        project_id=project.id,
        test_id="test::path",
        result="failed",
        env="staging",
        metadata={"fspath": "/test.py"},
        start_time=now - timedelta(hours=2),
    )

    additional_filters = ["env=production", "env=staging"]
    result = get_comparison_data(additional_filters)

    assert result is not None
    assert "results" in result
    assert "pagination" in result
    assert result["pagination"]["totalItems"] == 1

    # Verify the comparison
    comparison_pair = result["results"][0]
    result_prod, result_stag = comparison_pair
    assert result_prod["test_id"] == "test::path"
    assert result_stag["test_id"] == "test::path"
    assert result_prod["result"] == "passed"
    assert result_stag["result"] == "failed"
