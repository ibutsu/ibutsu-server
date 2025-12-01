"""Tests for result_aggregator widget"""

from ibutsu_server.widgets.result_aggregator import get_recent_result_data

MOCK_DAYS = 7
MOCK_GROUP_FIELD = "component"


def test_get_recent_result_data(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test the get_recent_result_data function with real database."""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create 10 results for component1 using bulk creator
    bulk_result_creator(
        count=10,
        run_id=run.id,
        project_id=project.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create 20 results for component2 using bulk creator
    bulk_result_creator(
        count=20,
        run_id=run.id,
        project_id=project.id,
        base_time=fixed_time,
        component="component2",
        result_pattern=lambda _: "passed",
    )

    # Call widget function
    result = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id))

    # Verify results are sorted by count descending
    assert len(result) == 2
    assert result[0] == {"_id": "component2", "count": 20}
    assert result[1] == {"_id": "component1", "count": 10}


def test_get_recent_result_data_with_run_filter(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test get_recent_result_data filters by run_id."""
    project = make_project(name="test-project")
    run1 = make_run(project_id=project.id)
    run2 = make_run(project_id=project.id)

    # Create results in run1 using bulk creator
    bulk_result_creator(
        count=5,
        run_id=run1.id,
        project_id=project.id,
        base_time=fixed_time,
        component="frontend",
        result_pattern=lambda _: "passed",
    )

    # Create results in run2 using bulk creator
    bulk_result_creator(
        count=10,
        run_id=run2.id,
        project_id=project.id,
        base_time=fixed_time,
        component="backend",
        result_pattern=lambda _: "passed",
    )

    # Query only run1
    result = get_recent_result_data(
        MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id), run_id=str(run1.id)
    )

    # Should only include run1 results
    assert len(result) == 1
    assert result[0] == {"_id": "frontend", "count": 5}


def test_get_recent_result_data_with_time_filter(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test get_recent_result_data filters by days."""
    from datetime import timedelta

    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    recent_time = fixed_time
    old_time = fixed_time - timedelta(days=30)

    # Create recent results using bulk creator
    bulk_result_creator(
        count=8,
        run_id=run.id,
        project_id=project.id,
        base_time=recent_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create old results (outside time window) using bulk creator
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=old_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Query with 7 days filter
    result = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id))

    # Should only include recent results
    assert len(result) == 1
    assert result[0]["_id"] == "component1"
    assert result[0]["count"] == 8


def test_get_recent_result_data_with_additional_filters(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test get_recent_result_data with additional filters."""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create results with different result statuses using bulk creator
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    bulk_result_creator(
        count=3,
        run_id=run.id,
        project_id=project.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "failed",
    )

    # Query with additional filter for failed results only
    result = get_recent_result_data(
        MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id), additional_filters="result=failed"
    )

    # Should only include failed results
    assert len(result) == 1
    assert result[0]["_id"] == "component1"
    assert result[0]["count"] == 3


def test_get_recent_result_data_no_results(db_session, make_project):
    """Test get_recent_result_data with no results."""
    project = make_project(name="empty-project")

    result = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id))

    assert len(result) == 0


def test_get_recent_result_data_without_group_field(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test get_recent_result_data with results that don't have the group field."""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create results without component field using bulk creator
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=fixed_time,
        result_pattern=lambda _: "passed",
        # No component specified
    )

    # Query by component - should exclude results without component
    result = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project.id))

    # Results without the group field should not be included
    # The filter includes {group_field}@y which means "exists"
    assert len(result) == 0


def test_get_recent_result_data_multiple_projects(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test that get_recent_result_data filters by project."""
    project1 = make_project(name="project1")
    project2 = make_project(name="project2")
    run1 = make_run(project_id=project1.id)
    run2 = make_run(project_id=project2.id)

    # Create results in project1 using bulk creator
    bulk_result_creator(
        count=5,
        run_id=run1.id,
        project_id=project1.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create results in project2 using bulk creator
    bulk_result_creator(
        count=10,
        run_id=run2.id,
        project_id=project2.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Query only project1
    result = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project1.id))

    # Should only include project1 results
    assert len(result) == 1
    assert result[0]["count"] == 5


def test_get_recent_result_data_overlapping_run_ids(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test that get_recent_result_data correctly filters by project even with similar data."""
    project1 = make_project(name="project1")
    project2 = make_project(name="project2")

    # Create separate runs for each project (run IDs must be unique)
    run1 = make_run(project_id=project1.id, metadata={"test": "run1"})
    run2 = make_run(project_id=project2.id, metadata={"test": "run2"})

    # Create results for project1
    bulk_result_creator(
        count=5,
        run_id=run1.id,
        project_id=project1.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create results for project2 with same component name
    bulk_result_creator(
        count=10,
        run_id=run2.id,
        project_id=project2.id,
        base_time=fixed_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Query for project1 - should only get project1 results
    result_project1 = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project1.id))
    assert len(result_project1) == 1
    assert result_project1[0]["count"] == 5

    # Query for project2 - should only get project2 results
    result_project2 = get_recent_result_data(MOCK_GROUP_FIELD, MOCK_DAYS, str(project2.id))
    assert len(result_project2) == 1
    assert result_project2[0]["count"] == 10


def test_get_recent_result_data_with_run_id_no_days(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test get_recent_result_data with run_id but no days."""
    from datetime import timedelta

    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    recent_time = fixed_time
    old_time = fixed_time - timedelta(days=100)

    # Create recent results using bulk creator
    bulk_result_creator(
        count=8,
        run_id=run.id,
        project_id=project.id,
        base_time=recent_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create old results in the same run
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=old_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Query with run_id but without days - should include all results from the run
    result = get_recent_result_data(
        MOCK_GROUP_FIELD, days=None, project=str(project.id), run_id=str(run.id)
    )

    # Should include all results from the run (no time filter applied)
    assert len(result) == 1
    assert result[0]["_id"] == "component1"
    assert result[0]["count"] == 13  # 8 + 5


def test_get_recent_result_data_default_90_days_without_run_id(
    db_session, make_project, make_run, bulk_result_creator, fixed_time
):
    """Test that get_recent_result_data defaults to 90 days when no run_id is provided."""
    from datetime import timedelta

    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    recent_time = fixed_time
    old_time = fixed_time - timedelta(days=100)

    # Create recent results
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=recent_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Create old results (100 days ago)
    bulk_result_creator(
        count=5,
        run_id=run.id,
        project_id=project.id,
        base_time=old_time,
        component="component1",
        result_pattern=lambda _: "passed",
    )

    # Query without days and without run_id
    result = get_recent_result_data(MOCK_GROUP_FIELD, days=None, project=str(project.id))

    # Should only include recent results (default 90 days)
    assert len(result) == 1
    assert result[0]["_id"] == "component1"
    assert result[0]["count"] == 5
