"""Tests for filter_heatmap widget"""

from ibutsu_server.widgets.filter_heatmap import get_filter_heatmap

MOCK_FILTERS = "component=filter-component"
MOCK_BUILDS = 5
MOCK_GROUP_FIELD = "component"


def test_get_filter_heatmap(make_project, bulk_run_creator, make_run, fixed_time):
    """Test the get_filter_heatmap function with real database data."""
    project = make_project(name="test-project")

    # Create runs with component=filter-component using bulk creator
    bulk_run_creator(
        count=3,
        project_id=project.id,
        base_time=fixed_time,
        component="filter-component",
        summary_pattern=lambda i: {
            "tests": 100,
            "failures": i * 2,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Create run with different component (should be filtered out)
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        component="other-component",
        summary={"tests": 50, "failures": 0, "errors": 0, "skips": 0, "xfailures": 0, "xpasses": 0},
    )

    result = get_filter_heatmap(MOCK_FILTERS, MOCK_BUILDS, MOCK_GROUP_FIELD, str(project.id))

    assert "heatmap" in result
    assert "filter-component" in result["heatmap"]
    # Should not include other-component
    assert "other-component" not in result["heatmap"]


def test_get_filter_heatmap_with_invalid_group_field(make_project, make_run, fixed_time):
    """Test get_filter_heatmap with invalid group field returns empty heatmap."""
    project = make_project(name="test-project")

    make_run(
        project_id=project.id,
        start_time=fixed_time,
        component="test-component",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Use an invalid group field that doesn't exist
    result = get_filter_heatmap(MOCK_FILTERS, MOCK_BUILDS, "invalid.field.name", str(project.id))

    assert "heatmap" in result
    assert result["heatmap"] == {}


def test_get_filter_heatmap_no_matching_data(make_project, make_run, fixed_time):
    """Test get_filter_heatmap with no matching data."""
    project = make_project(name="test-project")

    # Create run that doesn't match filter
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        component="other-component",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query for component that doesn't exist
    result = get_filter_heatmap(
        "component=non-existent-component", MOCK_BUILDS, MOCK_GROUP_FIELD, str(project.id)
    )

    assert "heatmap" in result
    assert result["heatmap"] == {}


def test_get_filter_heatmap_with_multiple_filters(make_project, make_run, fixed_time):
    """Test get_filter_heatmap with multiple filters."""
    project = make_project(name="test-project")

    # Create run matching all filters
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        component="test-component",
        env="production",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Create run matching only one filter
    make_run(
        project_id=project.id,
        start_time=fixed_time,
        component="test-component",
        env="staging",
        summary={
            "tests": 100,
            "failures": 10,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query with multiple filters
    result = get_filter_heatmap(
        "component=test-component,env=production", MOCK_BUILDS, MOCK_GROUP_FIELD, str(project.id)
    )

    assert "heatmap" in result
    assert "test-component" in result["heatmap"]


def test_get_filter_heatmap_calculates_slope(make_project, bulk_run_creator, fixed_time):
    """Test that get_filter_heatmap calculates slope correctly."""
    project = make_project(name="test-project")

    # Create runs with varying pass rates using bulk creator
    bulk_run_creator(
        count=5,
        project_id=project.id,
        base_time=fixed_time,
        component="test-component",
        summary_pattern=lambda i: {
            "tests": 100,
            "failures": i * 5,  # Increasing failures over time
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_filter_heatmap(
        "component=test-component", MOCK_BUILDS, MOCK_GROUP_FIELD, str(project.id)
    )

    assert "heatmap" in result
    assert "test-component" in result["heatmap"]
    # First element should be slope info
    assert isinstance(result["heatmap"]["test-component"][0], list)


def test_get_filter_heatmap_with_project_filter(make_project, make_run, fixed_time):
    """Test that get_filter_heatmap filters by project."""
    project1 = make_project(name="project1")
    project2 = make_project(name="project2")

    # Create run in project1
    make_run(
        project_id=project1.id,
        start_time=fixed_time,
        component="test-component",
        summary={
            "tests": 100,
            "failures": 5,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Create run in project2
    make_run(
        project_id=project2.id,
        start_time=fixed_time,
        component="test-component",
        summary={
            "tests": 100,
            "failures": 10,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Query only project1
    result = get_filter_heatmap(
        "component=test-component", MOCK_BUILDS, MOCK_GROUP_FIELD, str(project1.id)
    )

    assert "heatmap" in result
    assert "test-component" in result["heatmap"]


def test_get_filter_heatmap_limits_builds(make_project, bulk_run_creator, fixed_time):
    """Test that get_filter_heatmap limits the number of builds returned."""
    project = make_project(name="test-project")

    # Create more runs than MOCK_BUILDS using bulk creator
    bulk_run_creator(
        count=10,
        project_id=project.id,
        base_time=fixed_time,
        component="test-component",
        summary_pattern=lambda i: {
            "tests": 100,
            "failures": i,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_filter_heatmap(
        "component=test-component", MOCK_BUILDS, MOCK_GROUP_FIELD, str(project.id)
    )

    assert "heatmap" in result
    assert "test-component" in result["heatmap"]
    # Should have slope + at most MOCK_BUILDS entries
    assert len(result["heatmap"]["test-component"]) <= MOCK_BUILDS + 1


def test_get_filter_heatmap_with_zero_build_limit(make_project, bulk_run_creator, fixed_time):
    """Test get_filter_heatmap with builds=0."""
    project = make_project(name="test-project")

    # Create multiple runs
    bulk_run_creator(
        count=5,
        project_id=project.id,
        base_time=fixed_time,
        component="test-component",
        summary_pattern=lambda i: {
            "tests": 100,
            "failures": i,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Test with builds=0 - should handle gracefully
    result = get_filter_heatmap("component=test-component", 0, MOCK_GROUP_FIELD, str(project.id))

    assert result is not None
    assert "heatmap" in result
    # Widget should handle zero gracefully - either empty results or default behavior


def test_get_filter_heatmap_with_negative_build_limit(make_project, bulk_run_creator, fixed_time):
    """Test get_filter_heatmap with negative builds value."""
    project = make_project(name="test-project")

    # Create multiple runs
    bulk_run_creator(
        count=5,
        project_id=project.id,
        base_time=fixed_time,
        component="test-component",
        summary_pattern=lambda i: {
            "tests": 100,
            "failures": i,
            "errors": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Test with negative builds - should handle gracefully
    result = get_filter_heatmap("component=test-component", -5, MOCK_GROUP_FIELD, str(project.id))

    assert result is not None
    assert "heatmap" in result
    # Widget should handle negative values gracefully - either empty or treat as absolute/default
