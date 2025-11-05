"""Tests for jenkins_job_analysis widget"""

from ibutsu_server.widgets.jenkins_job_analysis import (
    get_jenkins_analysis_data,
    get_jenkins_bar_chart,
    get_jenkins_line_chart,
)

MOCK_JOB_NAME = "test-job"
MOCK_BUILDS = 10


def test_get_jenkins_line_chart(db_session, make_project, jenkins_run_factory, fixed_time):
    """Test the get_jenkins_line_chart function with real database data."""
    project = make_project(name="test-project")

    # Build 1: duration = 3600s (1 hour), total_execution_time = 7200s (2 hours)
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        duration=3600,
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )
    # Add another component for same build to make total_execution_time different
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        duration=3600,
        component="component2",
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Build 2: duration = 1800s (0.5 hour), total_execution_time = 1800s (0.5 hour)
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="2",
        project_id=project.id,
        start_time=fixed_time,
        duration=1800,
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert "duration" in result
    assert "total_execution_time" in result
    # Duration is converted to hours: 3600s = 1.0h, 1800s = 0.5h
    assert result["duration"]["1"] == 1.0
    assert result["duration"]["2"] == 0.5
    # Total execution time for build 1 should be 2.0h (two components of 1h each)
    assert result["total_execution_time"]["1"] == 2.0
    assert result["total_execution_time"]["2"] == 0.5


def test_get_jenkins_bar_chart(db_session, make_project, jenkins_run_factory, fixed_time):
    """Test the get_jenkins_bar_chart function with real database data."""
    project = make_project(name="test-project")

    # Create run with summary data
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        summary={"tests": 25, "failures": 3, "errors": 2, "skips": 1, "xfailures": 4, "xpasses": 5},
    )

    result = get_jenkins_bar_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    # passes = tests - (failures + errors + skips + xfailures + xpasses) = 25 - 15 = 10
    assert result["passed"] == {"1": 10}
    assert result["skipped"] == {"1": 1}
    assert result["error"] == {"1": 2}
    assert result["failed"] == {"1": 3}
    assert result["xfailed"] == {"1": 4}
    assert result["xpassed"] == {"1": 5}


def test_get_jenkins_analysis_data(db_session, make_project):
    """Test the get_jenkins_analysis_data function."""
    project = make_project(name="test-project")

    result = get_jenkins_analysis_data(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert "barchart_params" in result
    assert "heatmap_params" in result
    assert "linechart_params" in result
    assert result["barchart_params"] == {
        "job_name": MOCK_JOB_NAME,
        "builds": MOCK_BUILDS,
        "project": str(project.id),
    }
    assert result["heatmap_params"]["builds"] <= MOCK_BUILDS


def test_get_jenkins_line_chart_multiple_builds(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_line_chart with multiple builds."""
    project = make_project(name="test-project")

    # Create 5 builds with increasing durations
    for i in range(1, 6):
        jenkins_run_factory(
            job_name=MOCK_JOB_NAME,
            build_number=str(i),
            project_id=project.id,
            start_time=fixed_time,
            duration=1800 * i,  # 0.5h, 1h, 1.5h, 2h, 2.5h
            summary={
                "tests": 100,
                "failures": 0,
                "errors": 0,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
            },
        )

    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert len(result["duration"]) == 5
    # Check that durations are converted to hours correctly
    assert result["duration"]["1"] == 0.5
    assert result["duration"]["2"] == 1.0
    assert result["duration"]["5"] == 2.5


def test_get_jenkins_bar_chart_multiple_builds(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_bar_chart with multiple builds."""
    project = make_project(name="test-project")

    # Create 3 builds with different failure patterns
    for i in range(1, 4):
        jenkins_run_factory(
            job_name=MOCK_JOB_NAME,
            build_number=str(i),
            project_id=project.id,
            start_time=fixed_time,
            summary={
                "tests": 100,
                "failures": i * 2,
                "errors": i,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
            },
        )

    result = get_jenkins_bar_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert len(result["failed"]) == 3
    assert result["failed"]["1"] == 2
    assert result["failed"]["2"] == 4
    assert result["failed"]["3"] == 6


def test_get_jenkins_line_chart_no_data(db_session, make_project):
    """Test get_jenkins_line_chart with no matching data."""
    project = make_project(name="empty-project")

    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert "duration" in result
    assert len(result["duration"]) == 0


def test_get_jenkins_bar_chart_no_data(db_session, make_project):
    """Test get_jenkins_bar_chart with no matching data."""
    project = make_project(name="empty-project")

    result = get_jenkins_bar_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert "passed" in result
    assert len(result["passed"]) == 0


def test_get_jenkins_line_chart_single_component(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test get_jenkins_line_chart with single component (duration == total_execution_time)."""
    project = make_project(name="test-project")

    # Create run with single component
    jenkins_run_factory(
        job_name=MOCK_JOB_NAME,
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        duration=3600,
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    assert "duration" in result
    # When duration == total_execution_time, total_execution_time should not be in result
    # (no multiple components)
    assert result["duration"]["1"] == 1.0


def test_get_jenkins_line_chart_missing_fields(db_session, make_project, make_run, fixed_time):
    """Test get_jenkins_line_chart with missing duration and total_execution_time fields."""
    project = make_project(name="test-project-missing-fields")

    # Run with missing duration
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": MOCK_JOB_NAME, "build_number": "1"}},
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
        # duration is omitted
    )

    # Run with duration present (for comparison)
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        duration=1200,
        metadata={"jenkins": {"job_name": MOCK_JOB_NAME, "build_number": "2"}},
        summary={
            "tests": 100,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Call the widget function
    result = get_jenkins_line_chart(MOCK_JOB_NAME, MOCK_BUILDS, project=str(project.id))

    # Widget should handle missing fields gracefully
    assert "duration" in result
    # Run without duration might not appear in result or appear with None/0
    # At minimum, the widget shouldn't crash
    assert isinstance(result["duration"], dict)
