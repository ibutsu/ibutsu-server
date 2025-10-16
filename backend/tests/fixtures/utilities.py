"""
Utility fixtures for common test patterns.

This module provides fixtures for HTTP headers, pagination test cases,
and other common testing utilities.
"""

from unittest.mock import patch

import pytest

# ============================================================================
# UTILITY FIXTURES - HTTP headers, pagination, and common test patterns
# ============================================================================


@pytest.fixture
def pagination_test_cases():
    """Common pagination test cases."""
    return [
        (1, 25),
        (2, 10),
        (1, 50),
        (3, 5),
    ]


@pytest.fixture
def http_headers():
    """Standard HTTP headers for API requests."""
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


@pytest.fixture
def auth_headers(http_headers):
    """HTTP headers with authorization."""
    # This will be set by individual tests that need authentication
    return lambda token: {**http_headers, "Authorization": f"Bearer {token}"}


@pytest.fixture
def mocked_celery():
    """Mock Celery app for testing."""
    with patch("ibutsu_server.tasks.celery") as mock:
        yield mock
