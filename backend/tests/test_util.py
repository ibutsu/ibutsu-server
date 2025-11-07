"""Test utilities and base classes for ibutsu_server tests."""

import contextlib
import datetime
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from werkzeug.exceptions import BadRequest, Forbidden, InternalServerError, NotFound, Unauthorized

from ibutsu_server.db.models import (
    Artifact,
    Dashboard,
    Group,
    Import,
    ImportFile,
    Project,
    Result,
    Run,
    Token,
    User,
    WidgetConfig,
)
from ibutsu_server.util import (
    deserialize_date,
    deserialize_datetime,
    get_test_idents,
    json_response,
    merge_dicts,
    safe_string,
    serialize,
    serialize_error,
)
from ibutsu_server.util.projects import (
    add_user_filter,
    get_project,
    get_project_id,
    project_has_user,
)
from ibutsu_server.util.urls import build_url

# Export the DB models as Mock* classes for backwards compatibility
MockUser = User
MockProject = Project
MockDashboard = Dashboard
MockGroup = Group
MockToken = Token
MockImport = Import
MockImportFile = ImportFile
MockResult = Result
MockRun = Run
MockArtifact = Artifact
MockWidgetConfig = WidgetConfig


def mock_task(*args, **kwargs):
    """Mock task for testing"""
    pass


# Tests for util/__init__.py


def test_deserialize_date():
    """Test deserializing a date string."""
    result = deserialize_date("2023-01-15")
    assert isinstance(result, datetime.date)
    assert result.year == 2023
    assert result.month == 1
    assert result.day == 15


def test_deserialize_datetime():
    """Test deserializing a datetime string."""
    result = deserialize_datetime("2023-01-15T12:30:45")
    assert isinstance(result, datetime.datetime)
    assert result.year == 2023
    assert result.month == 1
    assert result.day == 15
    assert result.hour == 12
    assert result.minute == 30
    assert result.second == 45


def test_deserialize_datetime_with_timezone():
    """Test deserializing a datetime string with timezone."""
    result = deserialize_datetime("2023-01-15T12:30:45Z")
    assert isinstance(result, datetime.datetime)
    assert result.year == 2023


@pytest.mark.parametrize(
    ("input_value", "expected_substring"),
    [
        ("Test with émojis 😀 and special chars ñ", "Test with"),
        (b"Test bytes", "Test bytes"),
        (12345, "12345"),
    ],
)
def test_safe_string(input_value, expected_substring):
    """Test safe_string with various input types."""
    result = safe_string(input_value)
    assert isinstance(result, str)
    assert expected_substring in result


@pytest.mark.parametrize(
    ("setup_func", "expected"),
    [
        (
            lambda item: setattr(item, "location", ("test_file.py", 10, "test_function")),
            ("test_function", "test_file.py"),
        ),
        (
            lambda item: (
                delattr(item, "location"),
                setattr(item.fspath, "strpath", "/path/to/test.py"),
            )[1],
            ("/path/to/test.py", None),
        ),
        (
            lambda item: (delattr(item, "location"), delattr(item, "fspath")),
            (None, None),
        ),
    ],
)
def test_get_test_idents(setup_func, expected):
    """Test get_test_idents with various item configurations."""
    mock_item = MagicMock()
    mock_item.fspath = MagicMock()
    # Some setup functions may fail, which is expected for negative cases
    with contextlib.suppress(AttributeError, TypeError):
        setup_func(mock_item)
    result = get_test_idents(mock_item)
    assert result == expected


def test_merge_dicts_simple():
    """Test merge_dicts with simple dictionaries."""
    old_dict = {"a": 1, "b": 2, "c": 3}
    new_dict = {"b": 20, "d": 4}
    merge_dicts(old_dict, new_dict)
    assert new_dict == {"a": 1, "b": 20, "c": 3, "d": 4}


def test_merge_dicts_nested():
    """Test merge_dicts with nested dictionaries."""
    old_dict = {"a": {"x": 1, "y": 2}, "b": 3}
    new_dict = {"a": {"x": 10, "z": 3}, "c": 4}
    merge_dicts(old_dict, new_dict)
    assert new_dict == {"a": {"x": 10, "y": 2, "z": 3}, "b": 3, "c": 4}


def test_merge_dicts_with_none_values():
    """Test merge_dicts with None values in new_dict."""
    old_dict = {"a": 1, "b": 2}
    new_dict = {"a": None, "c": 3}
    merge_dicts(old_dict, new_dict)
    assert new_dict == {"a": 1, "b": 2, "c": 3}


@pytest.mark.parametrize(
    ("input_data", "expected_output", "check_id"),
    [
        (
            {"_id": ObjectId("507f1f77bcf86cd799439011"), "name": "test"},
            {"id": "507f1f77bcf86cd799439011", "name": "test"},
            True,
        ),
        ({"name": "test", "value": 123}, {"name": "test", "value": 123}, False),
        (None, None, False),
    ],
)
def test_serialize(input_data, expected_output, check_id):
    """Test serialize with various input types."""
    result = serialize(input_data)
    if check_id:
        assert "_id" not in result
        assert "id" in result
    assert result == expected_output


def test_json_response_default():
    """Test json_response with default status code."""
    response = json_response({"message": "success"})
    assert response.status_code == 200
    assert response.mimetype == "application/json"
    assert b'"message"' in response.data
    assert b'"success"' in response.data


def test_json_response_custom_status():
    """Test json_response with custom status code."""
    response = json_response({"error": "not found"}, status_code=404)
    assert response.status_code == 404
    assert response.mimetype == "application/json"


@pytest.mark.parametrize(
    ("exception_class", "message", "expected_status", "check_mimetype"),
    [
        (BadRequest, "Invalid input", 400, True),
        (Unauthorized, "Not authenticated", 401, False),
        (Forbidden, "Access denied", 403, False),
        (NotFound, "Resource not found", 404, False),
        (InternalServerError, "Server error", 500, False),
        (Exception, "Something went wrong", 500, False),
    ],
)
def test_serialize_error(exception_class, message, expected_status, check_mimetype):
    """Test serialize_error with various exception types."""
    error = exception_class(message)
    response = serialize_error(error)
    assert response.status_code == expected_status
    if check_mimetype:
        assert response.mimetype == "application/problem+json"
    assert b'"detail"' in response.data


# Tests for util/urls.py


def test_build_url_single_path():
    """Test build_url with a single path."""
    assert build_url("path") == "path"


def test_build_url_multiple_paths():
    """Test build_url with multiple paths."""
    assert build_url("base", "path", "to", "resource") == "base/path/to/resource"


def test_build_url_with_trailing_slashes():
    """Test build_url strips trailing slashes."""
    assert build_url("base/", "/path/", "/to/", "resource/") == "base/path/to/resource"


def test_build_url_with_https_protocol():
    """Test build_url with HTTPS protocol."""
    assert (
        build_url("https://example.com", "api", "v1", "users") == "https://example.com/api/v1/users"
    )


def test_build_url_with_http_protocol():
    """Test build_url with HTTP protocol."""
    assert (
        build_url("http://localhost:5000", "api", "results") == "http://localhost:5000/api/results"
    )


def test_build_url_with_empty_strings():
    """Test build_url with empty strings and None values."""
    result = build_url("base", "", "path", None, "resource")
    # Empty and None values should be skipped
    assert "base" in result
    assert "path" in result
    assert "resource" in result


# Tests for util/count.py
# Note: get_count_estimate and time_limited_db_operation are PostgreSQL-specific
# and cannot be tested with SQLite test fixtures


# Tests for util/projects.py


@pytest.mark.parametrize(
    ("use_id", "project_name", "should_find"),
    [
        (True, "test-project", True),
        (False, "test-project", True),
        (False, "non-existent-project", False),
    ],
)
def test_get_project(make_project, use_id, project_name, should_find):
    """Test get_project with various lookup methods."""
    if should_find:
        project = make_project(name=project_name)
        lookup_value = str(project.id) if use_id else project_name
        result = get_project(lookup_value)
        assert result is not None
        assert result.id == project.id
        if not use_id:
            assert result.name == project_name
    else:
        result = get_project(project_name)
        assert result is None


@pytest.mark.parametrize(
    ("project_exists", "project_name"),
    [
        (True, "test-project"),
        (False, "non-existent-project"),
    ],
)
def test_get_project_id(make_project, project_exists, project_name):
    """Test get_project_id with existing and non-existent projects."""
    if project_exists:
        project = make_project(name=project_name)
        result = get_project_id(project_name)
        assert result == str(project.id)
    else:
        result = get_project_id(project_name)
        assert result is None


@pytest.mark.parametrize(
    ("user_role", "expected_result"),
    [
        ("superadmin", True),
        ("owner", True),
        ("member", True),
        ("non_member", False),
    ],
)
def test_project_has_user(make_project, make_user, user_role, expected_result):
    """Test project_has_user with various user roles."""
    owner = make_user(email="owner@test.com")
    project = make_project(name="test-project", owner_id=owner.id)

    if user_role == "superadmin":
        user = make_user(email="admin@test.com", is_superadmin=True)
    elif user_role == "owner":
        user = owner
    elif user_role == "member":
        user = make_user(email="member@test.com")
        project.users.append(user)
    else:  # non_member
        user = make_user(email="nonmember@test.com")

    result = project_has_user(project, user)
    assert result is expected_result


def test_project_has_user_with_string_ids(make_project, make_user):
    """Test project_has_user with string IDs instead of objects."""
    owner = make_user(email="owner@test.com")
    project = make_project(name="test-project", owner_id=owner.id)
    member = make_user(email="member@test.com")
    project.users.append(member)
    # Pass string IDs instead of objects
    result = project_has_user(str(project.id), str(member.id))
    assert result is True


def test_add_user_filter_superadmin(make_project, make_user):
    """Test add_user_filter with superadmin user."""
    make_project(name="project1")
    make_project(name="project2")
    admin = make_user(email="admin@test.com", is_superadmin=True)

    query = Project.query
    filtered = add_user_filter(query, admin, model=Project)

    # Superadmin should see all projects
    results = filtered.all()
    assert len(results) >= 2


def test_add_user_filter_regular_user(make_project, make_user):
    """Test add_user_filter with regular user."""
    owner = make_user(email="owner@test.com")
    project1 = make_project(name="project1", owner_id=owner.id)
    make_project(name="project2")
    member = make_user(email="member@test.com")
    project1.users.append(member)

    query = Project.query
    filtered = add_user_filter(query, member, model=Project)

    # Regular user should only see their projects
    results = filtered.all()
    assert len(results) == 1
    assert results[0].id == project1.id


def test_add_user_filter_with_string_user_id(make_project, make_user):
    """Test add_user_filter with string user ID."""
    owner = make_user(email="owner@test.com")
    project = make_project(name="test-project", owner_id=owner.id)
    member = make_user(email="member@test.com")
    project.users.append(member)

    query = Project.query
    filtered = add_user_filter(query, str(member.id), model=Project)

    results = filtered.all()
    assert len(results) >= 1


__all__ = [
    "MockArtifact",
    "MockDashboard",
    "MockGroup",
    "MockImport",
    "MockImportFile",
    "MockProject",
    "MockResult",
    "MockRun",
    "MockToken",
    "MockUser",
    "MockWidgetConfig",
    "mock_task",
]
