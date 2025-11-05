"""Tests for result_summary widget"""

from uuid import uuid4

from ibutsu_server.widgets.result_summary import get_result_summary


def test_get_result_summary(make_project, make_run, app_context, fixed_time):
    """Test get_result_summary with real database data."""
    # Create project
    project = make_project(name="test-project")

    # Create runs with various summary data matching the original test patterns
    # This mimics the aggregated data that would be queried from the database
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={"errors": 0, "skips": 0, "failures": 0, "tests": 17, "xfailures": 0, "xpasses": 0},
    )
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={
            "errors": None,
            "skips": 0,
            "failures": 0,
            "tests": 3,
            "xfailures": 0,
            "xpasses": 0,
        },
    )
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={
            "errors": 0,
            "skips": 1,
            "failures": None,
            "tests": 7,
            "xfailures": 0,
            "xpasses": 0,
        },
    )
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={
            "errors": 1,
            "skips": None,
            "failures": 0,
            "tests": 1,
            "xfailures": 0,
            "xpasses": 0,
        },
    )
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={
            "errors": 2,
            "skips": 5,
            "failures": 3,
            "tests": 88,
            "xfailures": None,
            "xpasses": None,
        },
    )
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        env="prod",
        start_time=fixed_time,
        metadata={"jenkins": {"job_name": "prodTestSuite"}},
        summary={
            "errors": 0,
            "skips": 0,
            "failures": 0,
            "tests": None,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Call widget function with real data
    summary = get_result_summary(
        source="prodTestSuite", env="prod", job_name="prodTestSuite", project=str(project.id)
    )

    # Verify actual computed results
    expected_summary = {
        "error": 3,
        "skipped": 6,
        "failed": 3,
        "passed": 104,
        "total": 116,
        "xfailed": 0,
        "xpassed": 0,
    }
    assert summary == expected_summary


def test_get_result_summary_with_no_runs(db_session, make_project):
    """Test get_result_summary with empty project."""
    project = make_project(name="empty-project")

    summary = get_result_summary(project=str(project.id))

    # Should return zeros
    assert summary["total"] == 0
    assert summary["passed"] == 0
    assert summary["failed"] == 0
    assert summary["error"] == 0
    assert summary["skipped"] == 0


def test_get_result_summary_with_invalid_project_id(app_context):
    """Test get_result_summary with invalid project ID."""
    # Invalid UUID should be ignored by is_uuid() check
    summary = get_result_summary(project="not-a-uuid")

    # Should return zeros (no filter applied)
    assert summary["total"] == 0
    assert summary["passed"] == 0


def test_get_result_summary_with_valid_nonexistent_project_id(app_context):
    """Test get_result_summary with valid but non-existent project ID."""
    # Use a valid UUID that doesn't match any project
    non_existent_project_id = str(uuid4())
    summary = get_result_summary(project=non_existent_project_id)

    # Should return zeros (no results found for this project)
    assert summary["total"] == 0
    assert summary["passed"] == 0
    assert summary["failed"] == 0
    assert summary["error"] == 0
    assert summary["skipped"] == 0


def test_get_result_summary_with_additional_filters(db_session, make_project, make_run):
    """Test get_result_summary with additional filters."""
    project = make_project(name="test-project")

    # Create run that matches additional filter
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        component="frontend",
        summary={"errors": 0, "skips": 0, "failures": 5, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    # Create run that doesn't match additional filter
    make_run(
        project_id=project.id,
        source="prodTestSuite",
        component="backend",
        summary={
            "errors": 0,
            "skips": 0,
            "failures": 10,
            "tests": 100,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query with additional filter for frontend
    summary = get_result_summary(
        source="prodTestSuite", project=str(project.id), additional_filters="component=frontend"
    )

    # Should only count frontend run
    assert summary["total"] == 50
    assert summary["failed"] == 5
    assert summary["passed"] == 45


def test_get_result_summary_filters_by_source(db_session, make_project, make_run):
    """Test that get_result_summary correctly filters by source."""
    project = make_project(name="test-project")

    make_run(
        project_id=project.id,
        source="jenkins",
        summary={"errors": 0, "skips": 0, "failures": 5, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    make_run(
        project_id=project.id,
        source="github",
        summary={
            "errors": 0,
            "skips": 0,
            "failures": 10,
            "tests": 100,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query only jenkins source
    summary = get_result_summary(source="jenkins", project=str(project.id))

    assert summary["total"] == 50
    assert summary["failed"] == 5


def test_get_result_summary_filters_by_env(db_session, make_project, make_run):
    """Test that get_result_summary correctly filters by env."""
    project = make_project(name="test-project")

    make_run(
        project_id=project.id,
        env="production",
        summary={"errors": 0, "skips": 0, "failures": 5, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    make_run(
        project_id=project.id,
        env="staging",
        summary={
            "errors": 0,
            "skips": 0,
            "failures": 10,
            "tests": 100,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query only production env
    summary = get_result_summary(env="production", project=str(project.id))

    assert summary["total"] == 50
    assert summary["failed"] == 5
