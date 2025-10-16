"""Tests for importance_component widget"""

import pytest

from ibutsu_server.widgets.importance_component import get_importance_component


def test_get_importance_component_with_valid_project(make_project, make_run, make_result):
    """Test getting importance component with valid project ID"""
    # Create project and runs with results
    project = make_project(name="test-project")

    # Create two runs (builds)
    run1 = make_run(project_id=project.id, metadata={"job_name": "test-job", "build_number": "100"})
    run2 = make_run(project_id=project.id, metadata={"job_name": "test-job", "build_number": "101"})

    # Create results for component1 in build 100
    make_result(
        run_id=run1.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component1", "importance": "high", "build_number": "100"},
    )
    make_result(
        run_id=run1.id,
        project_id=project.id,
        result="failed",
        metadata={"component": "component1", "importance": "high", "build_number": "100"},
    )
    make_result(
        run_id=run1.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component1", "importance": "medium", "build_number": "100"},
    )

    # Create results for component2 in build 101
    make_result(
        run_id=run2.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component2", "importance": "low", "build_number": "101"},
    )

    # Test the widget function with real data
    result = get_importance_component(
        job_name="test-job", builds=5, components="component1,component2", project=str(project.id)
    )

    assert result is not None
    assert "table_data" in result
    assert isinstance(result["table_data"], list)


def test_get_importance_component_with_invalid_project():
    """Test getting importance component with invalid project ID"""
    project_id = "invalid-project-id"

    with pytest.raises(ValueError, match="Invalid project ID format"):
        get_importance_component(
            job_name="test-job", builds=5, components="component1", project=project_id
        )


def test_get_importance_component_with_none_project():
    """Test getting importance component with None project"""
    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=None
    )

    # When project is None, _get_results returns [], which becomes {"table_data": []}
    assert result == {"table_data": []}


def test_get_importance_component_with_count_skips(make_project, make_run, make_result):
    """Test getting importance component with count_skips enabled"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id, metadata={"job_name": "test-job", "build_number": "100"})

    # Create results with various statuses including skipped
    make_result(
        run_id=run.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component1", "importance": "high", "build_number": "100"},
    )
    make_result(
        run_id=run.id,
        project_id=project.id,
        result="skipped",
        metadata={"component": "component1", "importance": "high", "build_number": "100"},
    )

    result = get_importance_component(
        job_name="test-job",
        builds=5,
        components="component1,component2",
        project=str(project.id),
        count_skips=True,
    )

    assert result is not None
    assert "table_data" in result


def test_get_importance_component_empty_results(make_project):
    """Test getting importance component with no results"""
    project = make_project(name="test-project")

    # No results created, should return empty table_data
    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=str(project.id)
    )

    assert result is not None
    assert "table_data" in result
    assert len(result["table_data"]) == 0


def test_get_importance_component_different_builds(make_project, make_run, make_result):
    """Test getting importance component with different build numbers"""
    project = make_project(name="test-project")

    # Create runs with different build numbers
    run1 = make_run(project_id=project.id, metadata={"job_name": "test-job", "build_number": "100"})
    run2 = make_run(project_id=project.id, metadata={"job_name": "test-job", "build_number": "101"})

    # Create results for each build
    make_result(
        run_id=run1.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component1", "importance": "high", "build_number": "100"},
    )
    make_result(
        run_id=run2.id,
        project_id=project.id,
        result="passed",
        metadata={"component": "component1", "importance": "high", "build_number": "101"},
    )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=str(project.id)
    )

    assert result is not None
    assert "table_data" in result
