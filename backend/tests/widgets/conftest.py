"""
Fixtures specific to widget tests.

This module provides reusable fixtures for widget testing including:
- Standardized test data patterns
- Bulk data creation helpers
- Time handling utilities

These fixtures leverage the existing database builder fixtures (make_project,
make_run, make_result) while providing convenient patterns for widget tests.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest


@pytest.fixture
def fixed_time():
    """
    Provide a fixed datetime for consistent testing.

    Using a fixed time prevents flakiness in time-dependent assertions.
    Returns a timezone-aware datetime that can be used throughout tests.

    Note: Set to current time to work with widgets that filter by recent dates.

    Example:
        def test_time_based_query(fixed_time, make_run):
            run = make_run(start_time=fixed_time)
            assert run.start_time == fixed_time
    """
    return datetime.now(UTC)


@pytest.fixture
def jenkins_run_factory(make_run):
    """
    Factory for creating Jenkins-style runs with standardized metadata.

    Returns a callable that creates runs with Jenkins metadata structure
    matching the patterns used in controller tests.

    Args:
        job_name: Jenkins job name
        build_number: Build number (str or int)
        project_id: Project ID
        component: Optional component name
        start_time: Optional start time (defaults to now)
        duration: Optional duration in seconds
        summary: Optional test summary dict
        **kwargs: Additional run attributes

    Returns:
        Run: Created run instance

    Example:
        def test_jenkins_widget(make_project, jenkins_run_factory):
            project = make_project()
            run = jenkins_run_factory(
                job_name="my-job",
                build_number="100",
                project_id=project.id
            )
    """

    def _create_jenkins_run(
        job_name: str,
        build_number: str | int,
        project_id: str,
        component: str | None = None,
        start_time: datetime | None = None,
        duration: float | None = None,
        summary: dict[str, Any] | None = None,
        **kwargs,
    ):
        """Create a Jenkins run with standardized metadata."""
        # Default values
        if start_time is None:
            start_time = datetime.now(UTC)
        if duration is None:
            duration = 100.0
        if summary is None:
            summary = {
                "tests": 100,
                "failures": 0,
                "errors": 0,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
            }

        # Build Jenkins metadata structure
        metadata = {
            "jenkins": {"job_name": job_name, "build_number": str(build_number)},
        }

        # Merge any additional metadata from kwargs (deep merge for nested dicts)
        if "metadata" in kwargs:
            additional_metadata = kwargs.pop("metadata")
            for key, value in additional_metadata.items():
                if key in metadata and isinstance(metadata[key], dict) and isinstance(value, dict):
                    # Deep merge for nested dictionaries
                    metadata[key].update(value)
                else:
                    metadata[key] = value

        run_data = {
            "id": str(uuid4()),
            "project_id": project_id,
            "start_time": start_time,
            "duration": duration,
            "metadata": metadata,
            "summary": summary,
            "source": "jenkins",
        }

        if component:
            run_data["component"] = component

        run_data.update(kwargs)
        return make_run(**run_data)

    return _create_jenkins_run


@pytest.fixture
def standard_run_summary():
    """
    Provide a standard run summary matching sample data patterns.

    Returns:
        dict: Standard summary with all expected fields

    Example:
        def test_summary_handling(standard_run_summary, make_run):
            run = make_run(summary=standard_run_summary)
            assert run.summary["tests"] == 100
    """
    return {
        "tests": 100,
        "failures": 5,
        "errors": 2,
        "skips": 10,
        "xfailures": 1,
        "xpasses": 0,
        "collected": 100,
        "not_run": 0,
    }


@pytest.fixture
def bulk_run_creator(make_run, fixed_time):
    """
    Create multiple runs with sequential attributes.

    This helps eliminate loops from tests by providing a fixture that
    creates multiple runs with predictable patterns.

    Args:
        count: Number of runs to create
        project_id: Project ID for all runs
        base_time: Starting time (defaults to fixed_time)
        time_delta_hours: Hours between each run
        metadata_pattern: Function(index) -> dict for custom metadata
        summary_pattern: Function(index) -> dict for custom summaries
        **kwargs: Additional attributes for all runs

    Returns:
        list[Run]: List of created runs

    Example:
        def test_multiple_runs(make_project, bulk_run_creator):
            project = make_project()
            runs = bulk_run_creator(
                count=5,
                project_id=project.id,
                metadata_pattern=lambda i: {"build": str(i)}
            )
            assert len(runs) == 5
    """

    def _create_bulk_runs(
        count: int,
        project_id: str,
        base_time: datetime | None = None,
        time_delta_hours: int = 1,
        metadata_pattern: Callable | None = None,
        summary_pattern: Callable | None = None,
        **kwargs,
    ):
        """Create multiple runs with sequential patterns."""
        if base_time is None:
            base_time = fixed_time

        runs = []
        for i in range(count):
            run_data = {
                "id": str(uuid4()),
                "project_id": project_id,
                "start_time": base_time - timedelta(hours=i * time_delta_hours),
            }

            # Apply custom metadata pattern if provided
            if metadata_pattern:
                run_data["metadata"] = metadata_pattern(i)
            else:
                run_data["metadata"] = {}

            # Apply custom summary pattern if provided
            if summary_pattern:
                run_data["summary"] = summary_pattern(i)
            else:
                run_data["summary"] = {
                    "tests": 100,
                    "failures": i,
                    "errors": 0,
                    "skips": 0,
                    "xfailures": 0,
                    "xpasses": 0,
                }

            run_data.update(kwargs)
            runs.append(make_run(**run_data))

        return runs

    return _create_bulk_runs


@pytest.fixture
def bulk_result_creator(make_result, fixed_time):
    """
    Create multiple results with sequential attributes.

    This helps eliminate loops from tests by providing a fixture that
    creates multiple results with predictable patterns.

    Args:
        count: Number of results to create
        run_id: Run ID for all results
        project_id: Project ID for all results
        base_time: Starting time (defaults to fixed_time)
        component: Optional component name
        result_pattern: Function(index) -> str for result status
        **kwargs: Additional attributes for all results

    Returns:
        list[Result]: List of created results

    Example:
        def test_multiple_results(make_run, bulk_result_creator):
            run = make_run()
            results = bulk_result_creator(
                count=10,
                run_id=run.id,
                project_id=run.project_id,
                component="frontend"
            )
            assert len(results) == 10
    """

    def _create_bulk_results(
        count: int,
        run_id: str,
        project_id: str,
        base_time: datetime | None = None,
        component: str | None = None,
        result_pattern: Callable | None = None,
        **kwargs,
    ):
        """Create multiple results with sequential patterns."""
        if base_time is None:
            base_time = fixed_time

        results = []
        for i in range(count):
            result_data = {
                "id": str(uuid4()),
                "run_id": run_id,
                "project_id": project_id,
                "start_time": base_time + timedelta(seconds=i),
                "test_id": f"test.example.{uuid4().hex[:8]}",
            }

            # Apply custom result pattern if provided
            if result_pattern:
                result_data["result"] = result_pattern(i)
            else:
                result_data["result"] = "passed"

            if component:
                result_data["component"] = component

            result_data.update(kwargs)
            results.append(make_result(**result_data))

        return results

    return _create_bulk_results
