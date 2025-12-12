"""Tests for importance_component widget"""

import pytest

from ibutsu_server.widgets.importance_component import (
    _get_results,
    get_importance_component,
)


def test_get_importance_component_with_jenkins_metadata(make_project, make_run, make_result):
    """Test importance component with proper Jenkins metadata structure"""
    project = make_project(name="test-project")

    # Create run with Jenkins metadata structure that the widget expects
    run1 = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )

    # Create results with proper structure:
    # - component is a direct field on Result, not in metadata
    # - importance is at metadata.importance
    # - jenkins.build_number and jenkins.job_name in metadata
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="passed",
        metadata={"importance": "high", "jenkins": {"build_number": "100", "job_name": "test-job"}},
    )
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="failed",
        metadata={"importance": "high", "jenkins": {"build_number": "100", "job_name": "test-job"}},
    )
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="passed",
        metadata={
            "importance": "medium",
            "jenkins": {"build_number": "100", "job_name": "test-job"},
        },
    )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=str(project.id)
    )

    assert result is not None
    assert "table_data" in result
    assert len(result["table_data"]) > 0

    # Verify table_data structure
    table_entry = result["table_data"][0]
    assert "component" in table_entry
    assert "bnums" in table_entry
    assert "importances" in table_entry
    assert "data" in table_entry
    assert table_entry["component"] == "component1"
    assert "100" in table_entry["bnums"]


def test_get_importance_component_multiple_builds(make_project, make_run, make_result):
    """Test importance component with multiple builds and components"""
    project = make_project(name="test-project")

    # Create runs for different builds
    run1 = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )
    run2 = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "101"}},
    )

    # Build 100 - component1
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="passed",
        metadata={
            "importance": "critical",
            "jenkins": {"build_number": "100", "job_name": "test-job"},
        },
    )
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="passed",
        metadata={"importance": "high", "jenkins": {"build_number": "100", "job_name": "test-job"}},
    )

    # Build 101 - component1
    make_result(
        run_id=run2.id,
        project_id=project.id,
        component="component1",
        result="failed",
        metadata={
            "importance": "critical",
            "jenkins": {"build_number": "101", "job_name": "test-job"},
        },
    )

    # Build 100 - component2
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component2",
        result="passed",
        metadata={"importance": "low", "jenkins": {"build_number": "100", "job_name": "test-job"}},
    )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1,component2", project=str(project.id)
    )

    assert result is not None
    assert "table_data" in result
    # Should have entries for both components
    components = [entry["component"] for entry in result["table_data"]]
    assert "component1" in components
    assert "component2" in components


def test_get_importance_component_all_importances(make_project, make_run, make_result):
    """Test importance component with all importance levels"""
    project = make_project(name="test-project")

    run = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )

    # Create results with all importance levels
    for importance in ["critical", "high", "medium", "low"]:
        make_result(
            run_id=run.id,
            project_id=project.id,
            component="component1",
            result="passed",
            metadata={
                "importance": importance,
                "jenkins": {"build_number": "100", "job_name": "test-job"},
            },
        )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=str(project.id)
    )

    assert result is not None
    assert len(result["table_data"]) > 0

    # Verify all importances are present
    table_entry = result["table_data"][0]
    assert table_entry["importances"] == ["critical", "high", "medium", "low"]


def test_get_importance_component_with_various_results(make_project, make_run, make_result):
    """Test importance component with various result statuses (error, xpassed, xfailed)"""
    project = make_project(name="test-project")

    run = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )

    # Create results with various statuses
    for result_status in ["passed", "failed", "error", "xpassed", "xfailed"]:
        make_result(
            run_id=run.id,
            project_id=project.id,
            component="component1",
            result=result_status,
            metadata={
                "importance": "high",
                "jenkins": {"build_number": "100", "job_name": "test-job"},
            },
        )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=str(project.id)
    )

    assert result is not None
    assert len(result["table_data"]) > 0

    # Verify percentage is calculated
    table_entry = result["table_data"][0]
    high_data = table_entry["data"]["100"]["high"]
    assert "percentage" in high_data
    assert "result_list" in high_data
    assert len(high_data["result_list"]) == 5  # 5 results


def test_get_importance_component_count_skips_flag(make_project, make_run, make_result):
    """Test importance component count_skips flag affects percentage calculation"""
    project = make_project(name="test-project")

    run = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )

    # Create 2 passed and 2 skipped
    for _ in range(2):
        make_result(
            run_id=run.id,
            project_id=project.id,
            component="component1",
            result="passed",
            metadata={
                "importance": "high",
                "jenkins": {"build_number": "100", "job_name": "test-job"},
            },
        )
    for _ in range(2):
        make_result(
            run_id=run.id,
            project_id=project.id,
            component="component1",
            result="skipped",
            metadata={
                "importance": "high",
                "jenkins": {"build_number": "100", "job_name": "test-job"},
            },
        )

    # Without count_skips (default) - skipped doesn't count against percentage
    result_no_skip = get_importance_component(
        job_name="test-job",
        builds=5,
        components="component1",
        project=str(project.id),
        count_skips=False,
    )

    # With count_skips - skipped counts against percentage
    result_with_skip = get_importance_component(
        job_name="test-job",
        builds=5,
        components="component1",
        project=str(project.id),
        count_skips=True,
    )

    # Both should have results
    assert len(result_no_skip["table_data"]) > 0
    assert len(result_with_skip["table_data"]) > 0

    # Percentages should be different
    no_skip_pct = result_no_skip["table_data"][0]["data"]["100"]["high"]["percentage"]
    with_skip_pct = result_with_skip["table_data"][0]["data"]["100"]["high"]["percentage"]

    # Without count_skips: 2 passed out of 4 total,
    # but skipped not counted = 2/(4-2) = 1.0 or similar
    # With count_skips: 2 passed out of 4 total = 0.5
    assert no_skip_pct != with_skip_pct


def test_get_importance_component_missing_builds_for_component(make_project, make_run, make_result):
    """Test importance component fills in missing builds for components"""
    project = make_project(name="test-project")

    run1 = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "100"}},
    )
    run2 = make_run(
        project_id=project.id,
        metadata={"jenkins": {"job_name": "test-job", "build_number": "101"}},
    )

    # component1 only has results in build 100
    make_result(
        run_id=run1.id,
        project_id=project.id,
        component="component1",
        result="passed",
        metadata={
            "importance": "high",
            "jenkins": {"build_number": "100", "job_name": "test-job"},
        },
    )

    # component2 only has results in build 101
    make_result(
        run_id=run2.id,
        project_id=project.id,
        component="component2",
        result="passed",
        metadata={
            "importance": "high",
            "jenkins": {"build_number": "101", "job_name": "test-job"},
        },
    )

    result = get_importance_component(
        job_name="test-job", builds=5, components="component1,component2", project=str(project.id)
    )

    assert result is not None
    assert len(result["table_data"]) == 2

    # Each component should have both build numbers in bnums
    for table_entry in result["table_data"]:
        assert "100" in table_entry["bnums"]
        assert "101" in table_entry["bnums"]


def test_get_results_returns_empty_for_none_project():
    """Test _get_results returns empty list for None project"""
    results = _get_results("test-job", 5, "component1", None)
    assert results == []


def test_get_results_raises_for_invalid_uuid():
    """Test _get_results raises ValueError for invalid UUID"""
    with pytest.raises(ValueError, match="Invalid project ID format"):
        _get_results("test-job", 5, "component1", "not-a-uuid")


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
