"""
Test fixtures for ibutsu-server backend tests.

This module provides pytest fixtures and sample test data utilities.

Fixtures are automatically loaded by pytest via pytest_plugins in conftest.py.
All fixtures from the fixture modules are available to all tests.

Quick Start (Sample Data):
    from tests.fixtures.loader import load_sample_data

    def test_example(db_session):
        project, runs, results, artifacts = load_sample_data(db_session)
        # Your test logic here

Available Fixture Modules:
    - constants: Test constants (MOCK_USER_ID, MOCK_PROJECT_ID, etc.)
    - database: Flask app, db_session, and builder fixtures (make_project, make_run, etc.)
    - auth: Authentication and authorization fixtures
    - utilities: HTTP headers, pagination test cases, mocked_celery

Available Sample Data Functions:
    - load_sample_data: Load complete dataset
    - load_sample_project: Load just the project
    - load_sample_runs: Load runs
    - load_sample_results: Load results
    - load_sample_artifacts: Load artifacts
    - load_sample_run_with_results: Load a specific run with its results

See loader.py for full documentation and example_usage.py for usage patterns.
"""

# Import all fixtures to make them available when this module is used as a plugin
from .auth import *  # noqa: F403
from .constants import *  # noqa: F403
from .database import *  # noqa: F403
from .loader import (
    get_sample_metadata_patterns,
    load_failed_results_only,
    load_json_data,
    load_passed_results_only,
    load_sample_artifacts,
    load_sample_data,
    load_sample_project,
    load_sample_results,
    load_sample_run_with_results,
    load_sample_runs,
)
from .utilities import *  # noqa: F403

__all__ = [
    "get_sample_metadata_patterns",
    "load_failed_results_only",
    "load_json_data",
    "load_passed_results_only",
    "load_sample_artifacts",
    # Sample data loader functions
    "load_sample_data",
    "load_sample_project",
    "load_sample_results",
    "load_sample_run_with_results",
    "load_sample_runs",
]
