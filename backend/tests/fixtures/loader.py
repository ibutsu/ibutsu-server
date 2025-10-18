"""
Fixture data loader for sample test data.

This module provides utilities to load the sample test data into the database
for use in tests. It demonstrates the mechanism for loading data without
modifying existing test fixtures.

Usage Examples:
    # Load all data
    from tests.fixtures.loader import load_sample_data
    project, runs, results, artifacts = load_sample_data(db_session)

    # Load only project and runs
    from tests.fixtures.loader import load_sample_project, load_sample_runs
    project = load_sample_project(db_session)
    runs = load_sample_runs(db_session, project.id)

    # Load from JSON file
    from tests.fixtures.loader import load_json_data
    data = load_json_data()
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ibutsu_server.db.models import Artifact, Project, Result, Run


def get_fixture_path(filename: str) -> Path:
    """Get the absolute path to a fixture file."""
    return Path(__file__).parent / "data" / filename


def load_json_data() -> dict[str, Any]:
    """
    Load the sample test data from JSON file.

    Returns:
        dict: Complete test data including project, runs, results, and artifacts
    """
    fixture_path = get_fixture_path("sample_test_data.json")
    with fixture_path.open() as f:
        return json.load(f)


def load_artifact_content(filename: str) -> bytes:
    """
    Load artifact content from fixture file.

    Args:
        filename: Name of the artifact file

    Returns:
        bytes: File content as bytes
    """
    artifact_path = get_fixture_path(filename)
    with artifact_path.open("rb") as f:
        return f.read()


def parse_iso_datetime(date_string: str) -> datetime:
    """
    Parse ISO 8601 datetime string to datetime object.

    Args:
        date_string: ISO 8601 formatted datetime string

    Returns:
        datetime: Parsed datetime object
    """
    # Handle timezone-aware datetime strings
    if date_string.endswith("+00:00"):
        date_string = date_string[:-6] + "Z"
    return datetime.fromisoformat(date_string.replace("Z", "+00:00"))


def load_sample_project(session) -> Project:
    """
    Load the sample project into the database.

    Args:
        session: SQLAlchemy database session

    Returns:
        Project: Created project instance
    """
    data = load_json_data()
    project_data = data["project"]

    project = Project(**project_data)
    session.add(project)
    session.commit()
    session.refresh(project)

    return project


def load_sample_runs(session, project_id: Optional[str] = None) -> list[Run]:
    """
    Load sample runs into the database.

    Args:
        session: SQLAlchemy database session
        project_id: Optional project ID to override the one in the data

    Returns:
        list[Run]: List of created run instances
    """
    data = load_json_data()
    runs = []

    for run_data in data["runs"]:
        # Override project_id if provided
        if project_id:
            run_data_copy = run_data.copy()
            run_data_copy["project_id"] = project_id
        else:
            run_data_copy = run_data.copy()

        # Parse datetime fields
        if "start_time" in run_data_copy:
            run_data_copy["start_time"] = parse_iso_datetime(run_data_copy["start_time"])

        # Rename 'metadata' to 'data' (database field name)
        if "metadata" in run_data_copy:
            run_data_copy["data"] = run_data_copy.pop("metadata")

        run = Run(**run_data_copy)
        session.add(run)
        runs.append(run)

    session.commit()

    for run in runs:
        session.refresh(run)

    return runs


def load_sample_results(
    session, run_id: Optional[str] = None, project_id: Optional[str] = None
) -> list[Result]:
    """
    Load sample results into the database.

    Args:
        session: SQLAlchemy database session
        run_id: Optional run ID to override (loads only results for this run)
        project_id: Optional project ID to override

    Returns:
        list[Result]: List of created result instances
    """
    data = load_json_data()
    results = []

    for result_data in data["results"]:
        # Filter by run_id if provided
        if run_id and result_data.get("run_id") != run_id:
            continue

        # Make a copy to avoid modifying the original
        result_data_copy = result_data.copy()

        # Override IDs if provided
        if project_id:
            result_data_copy["project_id"] = project_id

        # Parse datetime fields
        if "start_time" in result_data_copy:
            result_data_copy["start_time"] = parse_iso_datetime(result_data_copy["start_time"])

        # Rename 'metadata' to 'data' (database field name)
        if "metadata" in result_data_copy:
            result_data_copy["data"] = result_data_copy.pop("metadata")

        result = Result(**result_data_copy)
        session.add(result)
        results.append(result)

    session.commit()

    for result in results:
        session.refresh(result)

    return results


def load_sample_artifacts(session, result_ids: Optional[list[str]] = None) -> list[Artifact]:
    """
    Load sample artifacts into the database.

    Args:
        session: SQLAlchemy database session
        result_ids: Optional list of result IDs to filter artifacts

    Returns:
        list[Artifact]: List of created artifact instances
    """
    data = load_json_data()
    artifacts = []

    for artifact_data in data["artifacts"]:
        # Filter by result_ids if provided
        if result_ids and artifact_data.get("result_id") not in result_ids:
            continue

        # Make a copy to avoid modifying the original
        artifact_data_copy = artifact_data.copy()

        # Load the actual content
        content_ref = artifact_data_copy.pop("content_reference", None)
        if content_ref:
            artifact_data_copy["content"] = load_artifact_content(content_ref)

        # Build data/metadata field
        artifact_data_copy["data"] = {
            "contentType": artifact_data_copy.pop("content_type", "application/octet-stream"),
            "resultId": artifact_data_copy.get("result_id"),
        }

        artifact = Artifact(**artifact_data_copy)
        session.add(artifact)
        artifacts.append(artifact)

    session.commit()

    for artifact in artifacts:
        session.refresh(artifact)

    return artifacts


def load_sample_data(
    session, load_artifacts_flag: bool = True
) -> tuple[Project, list[Run], list[Result], list[Artifact]]:
    """
    Load complete sample test data into the database.

    This is a convenience function that loads the project, runs, results,
    and optionally artifacts in the correct order.

    Args:
        session: SQLAlchemy database session
        load_artifacts_flag: Whether to load artifacts (default: True)

    Returns:
        tuple: (project, runs, results, artifacts)
            - project: Created Project instance
            - runs: List of created Run instances
            - results: List of created Result instances
            - artifacts: List of created Artifact instances (empty if load_artifacts_flag=False)

    Example:
        def test_with_sample_data(db_session):
            project, runs, results, artifacts = load_sample_data(db_session)
            assert len(runs) == 3
            assert len(results) == 9
            assert len(artifacts) == 4
    """
    # Load in dependency order
    project = load_sample_project(session)
    runs = load_sample_runs(session, project_id=project.id)
    results = load_sample_results(session, project_id=project.id)

    artifacts = []
    if load_artifacts_flag:
        result_ids = [r.id for r in results]
        artifacts = load_sample_artifacts(session, result_ids=result_ids)

    return project, runs, results, artifacts


def load_sample_run_with_results(session, run_index: int = 0) -> tuple[Project, Run, list[Result]]:
    """
    Load a single run with its results.

    Args:
        session: SQLAlchemy database session
        run_index: Index of the run to load (0-2, default: 0)

    Returns:
        tuple: (project, run, results)

    Example:
        def test_specific_run(db_session):
            project, run, results = load_sample_run_with_results(db_session, run_index=0)
            assert run.component == "frontend"
            assert len(results) == 5  # First run has 5 results
    """
    data = load_json_data()

    # Load project
    project = load_sample_project(session)

    # Load specific run
    run_data = data["runs"][run_index].copy()
    run_data["project_id"] = project.id

    if "start_time" in run_data:
        run_data["start_time"] = parse_iso_datetime(run_data["start_time"])

    if "metadata" in run_data:
        run_data["data"] = run_data.pop("metadata")

    run = Run(**run_data)
    session.add(run)
    session.commit()
    session.refresh(run)

    # Load results for this run
    results = load_sample_results(session, run_id=run.id, project_id=project.id)

    return project, run, results


# Convenience functions for specific data patterns


def load_failed_results_only(session) -> tuple[Project, Run, list[Result]]:
    """
    Load only failed results for testing error handling.

    Returns:
        tuple: (project, run, failed_results)
    """
    project, runs, all_results, _ = load_sample_data(session, load_artifacts_flag=False)

    failed_results = [r for r in all_results if r.result in ("failed", "error")]

    return project, runs[0], failed_results


def load_passed_results_only(session) -> tuple[Project, Run, list[Result]]:
    """
    Load only passed results for testing success scenarios.

    Returns:
        tuple: (project, run, passed_results)
    """
    project, runs, all_results, _ = load_sample_data(session, load_artifacts_flag=False)

    passed_results = [r for r in all_results if r.result == "passed"]

    return project, runs[0], passed_results


def get_sample_metadata_patterns() -> dict[str, Any]:
    """
    Get examples of different metadata patterns from the sample data.

    Useful for understanding the variety of metadata structures available.

    Returns:
        dict: Examples of different metadata patterns
    """
    data = load_json_data()

    return {
        "simple_result_metadata": data["results"][7]["metadata"],  # Simple metadata
        "complex_result_metadata": data["results"][0]["metadata"],  # Complex metadata
        "run_metadata_with_build": data["runs"][0]["metadata"],  # Build system info
        "run_metadata_with_deployment": data["runs"][1]["metadata"],  # Deployment info
        "result_with_performance": data["results"][8]["metadata"],  # Performance metrics
    }
