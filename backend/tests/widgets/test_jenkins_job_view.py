"""Tests for jenkins_job_view widget"""

from uuid import uuid4

from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view


def test_get_jenkins_job_view_default_parameters(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test getting jenkins job view with default parameters"""
    project = make_project(name="test-project")

    # Create a Jenkins run using factory with standardized metadata
    jenkins_run_factory(
        job_name="job1",
        build_number="100",
        project_id=project.id,
        start_time=fixed_time,
        duration=250.0,
        env="production",
        metadata={"jenkins": {"build_url": "http://jenkins/job/job1/100"}},
        summary={
            "errors": 0,
            "failures": 2,
            "skips": 5,
            "tests": 100,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_job_view()

    assert result is not None
    assert "jobs" in result
    assert "pagination" in result
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["job_name"] == "job1"
    assert result["jobs"][0]["build_number"] == "100"
    assert result["pagination"]["totalPages"] == 1


def test_get_jenkins_job_view_with_string_filters(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test getting jenkins job view with string filters"""
    project = make_project(name="test-project")

    # Create run matching filters
    jenkins_run_factory(
        job_name="test-job",
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        env="production",
        summary={"errors": 0, "failures": 0, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    # Create run not matching filters
    jenkins_run_factory(
        job_name="other-job",
        build_number="2",
        project_id=project.id,
        start_time=fixed_time,
        env="staging",
        summary={"errors": 0, "failures": 0, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    filters = "env=production,job_name=test-job"
    result = get_jenkins_job_view(additional_filters=filters)

    assert result is not None
    assert "jobs" in result
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["job_name"] == "test-job"
    assert result["jobs"][0]["env"] == "production"


def test_get_jenkins_job_view_with_list_filters(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test getting jenkins job view with list filters"""
    project = make_project(name="test-project")

    # Create run matching filters
    jenkins_run_factory(
        job_name="test-job",
        build_number="1",
        project_id=project.id,
        start_time=fixed_time,
        env="production",
        summary={"errors": 0, "failures": 0, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    filters = ["env=production", "job_name=test-job"]
    result = get_jenkins_job_view(additional_filters=filters)

    assert result is not None
    assert "jobs" in result
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["job_name"] == "test-job"


def test_get_jenkins_job_view_with_project(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test getting jenkins job view with project filter"""
    project1 = make_project(name="project1")
    project2 = make_project(name="project2")

    # Create run in project1
    jenkins_run_factory(
        job_name="job1",
        build_number="1",
        project_id=project1.id,
        start_time=fixed_time,
        summary={"errors": 0, "failures": 0, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    # Create run in project2
    jenkins_run_factory(
        job_name="job2",
        build_number="1",
        project_id=project2.id,
        start_time=fixed_time,
        summary={"errors": 0, "failures": 0, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    result = get_jenkins_job_view(project=str(project1.id))

    assert result is not None
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["job_name"] == "job1"


def test_get_jenkins_job_view_with_pagination(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test getting jenkins job view with pagination"""
    project = make_project(name="test-project")

    # Create 30 runs (to test pagination with page_size=25) using bulk creator
    bulk_run_creator(
        count=30,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": "1"}},
        summary_pattern=lambda _: {
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "tests": 50,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # Get first page
    result_page1 = get_jenkins_job_view(page=1, page_size=25)
    assert len(result_page1["jobs"]) == 25
    assert result_page1["pagination"]["page"] == 1
    assert result_page1["pagination"]["totalPages"] == 2

    # Get second page
    result_page2 = get_jenkins_job_view(page=2, page_size=25)
    assert len(result_page2["jobs"]) == 5
    assert result_page2["pagination"]["page"] == 2


def test_get_jenkins_job_view_with_run_limit(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test getting jenkins job view with run limit"""
    project = make_project(name="test-project")

    # Create 10 runs using bulk creator
    bulk_run_creator(
        count=10,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": "1"}},
        summary_pattern=lambda _: {
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "tests": 50,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    # run_limit should limit the runs considered for aggregation
    result = get_jenkins_job_view(run_limit=5)

    assert result is not None
    assert "jobs" in result
    # Should still get results, but limited
    assert len(result["jobs"]) <= 5


def test_get_jenkins_job_view_pagination_calculation(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test pagination calculation with different page sizes"""
    project = make_project(name="test-project")

    # Create 76 runs using bulk creator
    bulk_run_creator(
        count=76,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": "1"}},
        summary_pattern=lambda _: {
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "tests": 50,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_job_view(page_size=25)

    assert result is not None
    assert result["pagination"]["totalPages"] == 4


def test_get_jenkins_job_view_pagination_exact_page(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test pagination calculation with exact page division"""
    project = make_project(name="test-project")

    # Create 75 runs (exactly 3 pages of 25) using bulk creator
    bulk_run_creator(
        count=75,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": "1"}},
        summary_pattern=lambda _: {
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "tests": 50,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_job_view(page_size=25)

    assert result is not None
    assert result["pagination"]["totalPages"] == 3


def test_get_jenkins_job_view_empty_results(db_session, make_project):
    """Test getting jenkins job view with no results"""
    project = make_project(name="empty-project")

    result = get_jenkins_job_view(project=str(project.id))

    assert result is not None
    assert len(result["jobs"]) == 0
    assert result["pagination"]["totalPages"] == 0


def test_get_jenkins_job_view_all_parameters(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test getting jenkins job view with all parameters"""
    project = make_project(name="test-project")

    # Create multiple runs using bulk creator
    bulk_run_creator(
        count=60,
        project_id=project.id,
        base_time=fixed_time,
        env="production",
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": "1"}},
        summary_pattern=lambda _: {
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "tests": 50,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    filters = ["env=production"]
    result = get_jenkins_job_view(
        additional_filters=filters, project=str(project.id), page=2, page_size=50, run_limit=1000
    )

    assert result is not None
    assert result["pagination"]["page"] == 2
    assert result["pagination"]["pageSize"] == 50


def test_get_jenkins_job_view_aggregates_multiple_runs_per_build(
    db_session, make_project, jenkins_run_factory, fixed_time
):
    """Test that jenkins_job_view aggregates multiple runs with same job_name and build_number"""
    project = make_project(name="test-project")

    # Create multiple runs for the same job and build (different components)
    jenkins_run_factory(
        job_name="test-job",
        build_number="100",
        project_id=project.id,
        start_time=fixed_time,
        component="component1",
        summary={"errors": 0, "failures": 2, "skips": 0, "tests": 50, "xfailures": 0, "xpasses": 0},
    )

    jenkins_run_factory(
        job_name="test-job",
        build_number="100",
        project_id=project.id,
        start_time=fixed_time,
        component="component2",
        summary={
            "errors": 1,
            "failures": 3,
            "skips": 5,
            "tests": 100,
            "xfailures": 0,
            "xpasses": 0,
        },
    )

    result = get_jenkins_job_view()

    assert result is not None
    assert len(result["jobs"]) == 1  # Should aggregate into single job
    job = result["jobs"][0]
    assert job["job_name"] == "test-job"
    assert job["build_number"] == "100"
    # Should sum the test counts
    assert job["summary"]["tests"] == 150  # 50 + 100
    assert job["summary"]["failures"] == 5  # 2 + 3
    assert job["summary"]["errors"] == 1
    assert job["summary"]["skips"] == 5


def test_get_jenkins_job_view_run_limit_zero(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test jenkins job view with run_limit=0"""
    project = make_project(name="test-project")

    # Create multiple runs
    bulk_run_creator(
        count=5,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": str(i)}},
    )

    # Test with run_limit=0 - should handle gracefully (likely return empty or all results)
    result = get_jenkins_job_view(run_limit=0, project=str(project.id))

    assert result is not None
    assert "jobs" in result
    # Behavior with run_limit=0 depends on implementation
    # Either returns empty results or defaults to returning all


def test_get_jenkins_job_view_run_limit_negative(
    db_session, make_project, bulk_run_creator, fixed_time
):
    """Test jenkins job view with negative run_limit"""
    project = make_project(name="test-project")

    # Create multiple runs
    bulk_run_creator(
        count=5,
        project_id=project.id,
        base_time=fixed_time,
        source="jenkins",
        metadata_pattern=lambda i: {"jenkins": {"job_name": f"job{i}", "build_number": str(i)}},
    )

    # Test with negative run_limit - should handle gracefully
    result = get_jenkins_job_view(run_limit=-5, project=str(project.id))

    assert result is not None
    assert "jobs" in result
    # Negative values should either be treated as 0, default, or absolute value


def test_get_jenkins_job_view_invalid_parameters(db_session, make_project):
    """Test jenkins job view with invalid parameter values"""
    project = make_project(name="test-project")

    # The widget function should handle invalid parameters gracefully
    # Note: Type conversion happens at the API layer, so widget might receive converted values
    # Testing behavior when invalid types are passed through

    # Test with valid UUID project that doesn't exist
    non_existent_project = str(uuid4())
    result = get_jenkins_job_view(project=non_existent_project)

    assert result is not None
    assert len(result["jobs"]) == 0

    # Test with empty filter string
    result = get_jenkins_job_view(additional_filters="", project=str(project.id))

    assert result is not None
    assert "jobs" in result

    # Test with default values (None for optional params translates to defaults at API layer)
    result = get_jenkins_job_view(project=str(project.id))

    assert result is not None
    assert "pagination" in result
