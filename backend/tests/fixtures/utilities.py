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


# ============================================================================
# CONNEXION 3 HELPERS - Working with httpx responses
# ============================================================================


def get_json(response):
    """
    Extract JSON from Connexion 3 (httpx) response.

    Connexion 3 uses httpx which has response.json() method (not get_json()).
    This helper provides a consistent interface.

    Args:
        response: httpx.Response object from Connexion 3 test client

    Returns:
        dict: Parsed JSON response

    Example:
        response = client.get('/api/health')
        data = get_json(response)
    """
    return response.json()


def get_text(response):
    """
    Get response text from Connexion 3 (httpx) response.

    Args:
        response: httpx.Response object from Connexion 3 test client

    Returns:
        str: Response text

    Example:
        response = client.get('/api/health')
        text = get_text(response)
    """
    return response.text


@pytest.fixture
def json_response():
    """Fixture that provides helper to extract JSON from responses."""
    return get_json
