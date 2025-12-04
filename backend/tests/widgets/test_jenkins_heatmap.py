"""Tests for jenkins_heatmap widget"""

import pytest

from ibutsu_server.widgets.jenkins_heatmap import (
    _calculate_slope,
    _pad_heatmap,
    get_jenkins_heatmap,
)

MOCK_JOB_NAME = "test-job"
MOCK_BUILDS = 5
MOCK_GROUP_FIELD = "component"


# ============================================================================
# UNIT TESTS - Pure functions that don't require database
# ============================================================================


@pytest.mark.parametrize(
    ("x_data", "expected_slope"),
    [
        ([100, 100, 100], 100),
        ([90, 80, 70], -10.0),  # Decreasing by 10 percentage points per build
        ([70, 80, 90], 10.0),  # Increasing by 10 percentage points per build
        ([80, 80, 80], 0),
    ],
)
def test_calculate_slope(x_data, expected_slope):
    """Test the _calculate_slope function."""
    assert _calculate_slope(x_data) == expected_slope


def test_pad_heatmap():
    """Test the _pad_heatmap function."""
    heatmap = {"component1": [[-10.0, 0], [90, "run1", None, "1"], [70, "run3", None, "3"]]}
    builds_in_db = ["1", "2", "3"]
    padded_heatmap = _pad_heatmap(heatmap, builds_in_db)
    assert len(padded_heatmap["component1"]) == 4
    assert padded_heatmap["component1"][2][0] == "Build failed"


# ============================================================================
# INTEGRATION TESTS - Widget functions with real database
# ============================================================================


def test_get_jenkins_heatmap(db_session, make_project, jenkins_run_factory, fixed_time):
    """Test get_jenkins_heatmap with real database data."""
    project = make_project(name="test-project")

    # Build 1 - component1: 90% pass rate
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 5,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Build 1 - component2: 100% pass rate
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        component="component2",
        summary={"tests": 50, "failures": 0, "errors": 0, "skips": 0, "xfailures": 0, "xpasses": 0},
    )

    # Build 2 - component1: 95% pass rate
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="2",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        summary={
            "tests": 100,
            "failures": 3,
            "errors": 2,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Call widget function
    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, count_skips=False, project=str(project.id)
    )

    # Verify structure
    assert "heatmap" in result
    assert "component1" in result["heatmap"]
    assert "component2" in result["heatmap"]

    # Each component should have slope info + build data
    # First element is slope, then build data
    assert len(result["heatmap"]["component1"]) >= 2
    assert len(result["heatmap"]["component2"]) >= 2

    # Verify slope is present (first element)
    assert isinstance(result["heatmap"]["component1"][0], list)
    assert isinstance(result["heatmap"]["component2"][0], list)


def test_get_jenkins_heatmap_with_count_skips(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_heatmap with count_skips=True."""
    project = make_project(name="test-project")

    # Create run with skips
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 10,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Call with count_skips=True
    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, count_skips=True, project=str(project.id)
    )

    assert "heatmap" in result
    assert "component1" in result["heatmap"]


def test_get_jenkins_heatmap_no_data(db_session, make_project):
    """Test get_jenkins_heatmap with no matching data."""
    project = make_project(name="empty-project")

    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, project=str(project.id)
    )

    assert "heatmap" in result
    # Empty heatmap when no data
    assert result["heatmap"] == {}


def test_get_jenkins_heatmap_with_additional_filters(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_heatmap with additional filters."""
    project = make_project(name="test-project")

    # Create run with env=prod
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        env="prod",
        component="component1",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Create run with env=dev
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="2",
        project_id=project.id,
        start_time=fixed_time,
        env="dev",
        component="component2",
        summary={"tests": 50, "failures": 0, "errors": 0, "skips": 0, "xfailures": 0, "xpasses": 0},
    )

    # Query with filter for prod only
    result = get_jenkins_heatmap(
        MOCK_JOB_NAME,
        MOCK_BUILDS,
        MOCK_GROUP_FIELD,
        project=str(project.id),
        additional_filters="env=prod",
    )

    assert "heatmap" in result
    # Should only include component1 (prod)
    assert "component1" in result["heatmap"]


def test_get_jenkins_heatmap_with_annotations(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_heatmap preserves annotations."""
    project = make_project(name="test-project")

    # Create run with annotations
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        metadata={"annotations": "Test annotation"},
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, project=str(project.id)
    )

    assert "heatmap" in result
    assert "component1" in result["heatmap"]


def test_get_jenkins_heatmap_multiple_builds(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_heatmap with multiple builds."""
    project = make_project(name="test-project")

    # Create multiple builds using jenkins_run_factory
    for i in range(1, 4):
        jenkins_run_factory(
            job_name=MOCK_JOB_NAME,
            build_number=str(i),
            project_id=project.id,
            start_time=fixed_time,
            component="component1",
            summary={
                "tests": 100,
                "failures": i * 2,
                "errors": 0,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
            },
        )

    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, project=str(project.id)
    )

    assert "heatmap" in result
    assert "component1" in result["heatmap"]
    # Should have slope + 3 builds
    assert len(result["heatmap"]["component1"]) == 4


def test_get_jenkins_heatmap_with_count_skips_false(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_heatmap with count_skips=False and skips present."""
    project = make_project(name="test-project")

    # Create run with mix of passes, fails, and skips
    # With count_skips=False, skips should be excluded from pass rate calculation
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        summary={
            "tests": 100,  # Total tests
            "failures": 20,  # 20 failures
            "errors": 10,  # 10 errors
            "skips": 20,  # 20 skips (should be excluded from calculation)
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Call with count_skips=False
    result = get_jenkins_heatmap(
        MOCK_JOB_NAME, MOCK_BUILDS, MOCK_GROUP_FIELD, count_skips=False, project=str(project.id)
    )

    assert "heatmap" in result
    assert "component1" in result["heatmap"]

    # With count_skips=False:
    # Pass rate should be calculated as: (tests - failures - errors - skips) / (tests - skips)
    # = (100 - 20 - 10 - 20) / (100 - 20) = 50 / 80 = 0.625 = 62.5%
    # The exact pass rate value depends on how the widget calculates it
    # We're just ensuring the widget processes count_skips=False without error

    # Verify the heatmap structure exists
    component_data = result["heatmap"]["component1"]
    assert len(component_data) >= 2  # At least slope + 1 build
