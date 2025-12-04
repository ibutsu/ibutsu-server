"""
Data factories for creating complex test objects.

These factories help generate realistic test data with appropriate defaults.
"""

from datetime import UTC, datetime
from uuid import uuid4


def result_factory(**kwargs):
    """
    Create a result dictionary with sensible defaults.

    Args:
        **kwargs: Override default values

    Returns:
        dict: Result data dictionary

    Example:
        result_data = result_factory(
            test_id='test.example',
            result='failed',
            metadata={'component': 'frontend'}
        )
    """
    defaults = {
        "id": str(uuid4()),
        "duration": 1.0,
        "result": "passed",
        "test_id": f"test.example.{uuid4().hex[:8]}",
        "start_time": datetime.now(UTC).isoformat(),
        "source": "pytest",
        "metadata": {},
        "params": {},
    }
    defaults.update(kwargs)
    return defaults


def run_factory(**kwargs):
    """
    Create a run dictionary with sensible defaults.

    Args:
        **kwargs: Override default values

    Returns:
        dict: Run data dictionary

    Example:
        run_data = run_factory(
            metadata={'build_number': 100, 'env': 'production'}
        )
    """
    defaults = {
        "id": str(uuid4()),
        "start_time": datetime.now(UTC).isoformat(),
        "summary": {},
        "metadata": {},
    }
    defaults.update(kwargs)
    return defaults


def project_factory(**kwargs):
    """
    Create a project dictionary with sensible defaults.

    Args:
        **kwargs: Override default values

    Returns:
        dict: Project data dictionary

    Example:
        project_data = project_factory(
            name='my-project',
            title='My Test Project'
        )
    """
    unique_suffix = uuid4().hex[:8]
    defaults = {
        "id": str(uuid4()),
        "name": f"test-project-{unique_suffix}",
        "title": f"Test Project {unique_suffix}",
    }
    defaults.update(kwargs)
    return defaults


def user_factory(**kwargs):
    """
    Create a user dictionary with sensible defaults.

    Args:
        **kwargs: Override default values

    Returns:
        dict: User data dictionary

    Example:
        user_data = user_factory(
            email='admin@example.com',
            is_superadmin=True
        )
    """
    unique_suffix = uuid4().hex[:8]
    defaults = {
        "id": str(uuid4()),
        "name": f"Test User {unique_suffix}",
        "email": f"test-{unique_suffix}@example.com",
        "is_active": True,
        "is_superadmin": False,
    }
    defaults.update(kwargs)
    return defaults
