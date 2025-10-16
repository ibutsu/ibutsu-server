"""
Common test assertions.

These functions provide reusable assertion patterns for common test scenarios.
"""

from uuid import UUID

import pytest


def assert_pagination(response_json, expected_page, expected_page_size, expected_total):
    """
    Assert pagination structure is correct.

    Args:
        response_json: JSON response from API
        expected_page: Expected page number
        expected_page_size: Expected page size
        expected_total: Expected total items

    Example:
        assert_pagination(response.json, page=1, page_size=25, total=100)
    """
    assert "pagination" in response_json, "Response missing pagination object"
    pagination = response_json["pagination"]

    assert pagination["page"] == expected_page, (
        f"Expected page {expected_page}, got {pagination['page']}"
    )
    assert pagination["pageSize"] == expected_page_size, (
        f"Expected pageSize {expected_page_size}, got {pagination['pageSize']}"
    )
    assert pagination["totalItems"] == expected_total, (
        f"Expected totalItems {expected_total}, got {pagination['totalItems']}"
    )

    # Calculate and verify totalPages
    if expected_total == 0:
        expected_pages = 0
    else:
        expected_pages = (expected_total + expected_page_size - 1) // expected_page_size

    assert pagination["totalPages"] == expected_pages, (
        f"Expected totalPages {expected_pages}, got {pagination['totalPages']}"
    )


def assert_uuid_format(value, field_name=None):
    """
    Assert value is a valid UUID string.

    Args:
        value: Value to check
        field_name: Optional field name for better error messages

    Example:
        assert_uuid_format(result['id'], 'result.id')
    """
    field_info = f" for field '{field_name}'" if field_name else ""

    if value is None:
        pytest.fail(f"Value{field_info} is None, expected UUID string")

    if not isinstance(value, str):
        pytest.fail(f"Value{field_info} is not a string: {type(value).__name__}")

    try:
        UUID(value)
    except (ValueError, AttributeError) as e:
        pytest.fail(f"Value '{value}'{field_info} is not a valid UUID: {e}")


def assert_valid_response(response, expected_status=200, content_type="application/json"):
    """
    Assert response has expected status and content type.

    Args:
        response: Flask test response
        expected_status: Expected HTTP status code
        content_type: Expected content type

    Example:
        assert_valid_response(response, 201)
    """
    assert response.status_code == expected_status, (
        f"Expected status {expected_status}, got {response.status_code}. "
        f"Response: {response.data.decode('utf-8')}"
    )

    if content_type:
        actual_content_type = response.content_type
        # Handle cases like 'application/json; charset=utf-8'
        if actual_content_type:
            actual_content_type = actual_content_type.split(";")[0].strip()

        assert actual_content_type == content_type, (
            f"Expected content type '{content_type}', got '{actual_content_type}'"
        )


def assert_response_has_keys(response_json, *keys):
    """
    Assert response JSON contains all specified keys.

    Args:
        response_json: JSON response from API
        *keys: Keys that should be present

    Example:
        assert_response_has_keys(response.json, 'id', 'name', 'title')
    """
    for key in keys:
        assert key in response_json, f"Response missing required key: '{key}'"
