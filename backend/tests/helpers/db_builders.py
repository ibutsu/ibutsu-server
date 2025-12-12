"""
Builder patterns for creating complex test data.

These functions help create related sets of database objects for testing.
"""

from uuid import uuid4

from ibutsu_server.db.models import Project, Result, Run


def create_project_with_runs(session, num_runs=5, **project_kwargs):
    """
    Create a project with multiple runs.

    Args:
        session: SQLAlchemy session
        num_runs: Number of runs to create
        **project_kwargs: Additional arguments for Project creation

    Returns:
        tuple: (project, list of runs)

    Example:
        project, runs = create_project_with_runs(
            session,
            num_runs=3,
            name='test-project'
        )
    """
    project_defaults = {
        "id": str(uuid4()),
        "name": f"test-project-{uuid4().hex[:8]}",
        "title": "Test Project",
    }
    project_defaults.update(project_kwargs)
    project = Project(**project_defaults)
    session.add(project)
    session.commit()
    session.refresh(project)

    runs = []
    for i in range(num_runs):
        run = Run(
            id=str(uuid4()),
            project_id=project.id,
            metadata={"build_number": i + 1},
        )
        session.add(run)
        runs.append(run)
    session.commit()

    for run in runs:
        session.refresh(run)

    return project, runs


def create_results_for_run(session, run, num_results=10, **result_kwargs):
    """
    Create multiple results for a run.

    Args:
        session: SQLAlchemy session
        run: Run object to associate results with
        num_results: Number of results to create
        **result_kwargs: Additional arguments for Result creation

    Returns:
        list: List of created results

    Example:
        results = create_results_for_run(
            session,
            run,
            num_results=5,
            result='passed',
            component='frontend'
        )
    """
    results = []
    for i in range(num_results):
        result_defaults = {
            "id": str(uuid4()),
            "run_id": run.id,
            "project_id": run.project_id,
            "test_id": f"test.example.{i}",
            "result": "passed",
            "duration": 1.0,
            "metadata": {},
        }
        result_defaults.update(result_kwargs)
        result = Result(**result_defaults)
        session.add(result)
        results.append(result)
    session.commit()

    for result in results:
        session.refresh(result)

    return results


def create_run_with_results(
    session, project_id, num_results=10, run_metadata=None, **result_kwargs
):
    """
    Create a run with multiple results.

    Args:
        session: SQLAlchemy session
        project_id: Project ID to associate run with
        num_results: Number of results to create
        run_metadata: Metadata dictionary for the run
        **result_kwargs: Additional arguments for Result creation

    Returns:
        tuple: (run, list of results)

    Example:
        run, results = create_run_with_results(
            session,
            project_id=project.id,
            num_results=3,
            run_metadata={'build': 100},
            result='passed'
        )
    """
    run = Run(
        id=str(uuid4()),
        project_id=project_id,
        metadata=run_metadata or {},
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    results = create_results_for_run(session, run, num_results, **result_kwargs)

    return run, results
