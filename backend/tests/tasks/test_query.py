"""Tests for ibutsu_server.tasks.query module"""

from ibutsu_server.tasks.query import query_task


def test_query_task_results(make_project, make_run, make_result, flask_app, fixed_time):
    """Test query_task for results."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create 30 results
        for i in range(30):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_{i}",
                result="passed",
                start_time=fixed_time,
            )

        # Query with pagination
        result = query_task(filter_=None, page=1, page_size=10, tablename="results")

        assert "results" in result
        assert "pagination" in result
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["pageSize"] == 10
        assert result["pagination"]["totalItems"] == 30
        assert result["pagination"]["totalPages"] == 3
        assert len(result["results"]) == 10


def test_query_task_with_filter(make_project, make_run, make_result, flask_app, fixed_time):
    """Test query_task with filter."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create results with different statuses
        for i in range(10):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_p_{i}",
                result="passed",
                start_time=fixed_time,
            )
        for i in range(5):
            make_result(
                run_id=run.id,
                project_id=project.id,
                test_id=f"test_f_{i}",
                result="failed",
                start_time=fixed_time,
            )

        # Query only failed results
        result = query_task(filter_=["result=failed"], page=1, page_size=25, tablename="results")

        assert result["pagination"]["totalItems"] == 5
        assert len(result["results"]) == 5


def test_query_task_runs(make_project, make_run, flask_app, fixed_time):
    """Test query_task for runs."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create runs
        for i in range(15):
            make_run(project_id=project.id, start_time=fixed_time, metadata={"build": i})

        result = query_task(filter_=None, page=1, page_size=10, tablename="runs")

        assert "runs" in result
        assert result["pagination"]["totalItems"] == 15
        assert len(result["runs"]) == 10
