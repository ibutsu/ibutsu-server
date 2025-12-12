"""Test utilities and base classes for ibutsu_server tests."""

import contextlib
import datetime
import uuid
from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId
from werkzeug.exceptions import BadRequest, Forbidden, InternalServerError, NotFound, Unauthorized

from ibutsu_server.db import db
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
from ibutsu_server.errors import IbutsuError
from ibutsu_server.util import (
    _deserialize,
    _deserialize_dict,
    _deserialize_list,
    _deserialize_object,
    _deserialize_primitive,
    deserialize_date,
    deserialize_datetime,
    deserialize_model,
    get_test_idents,
    json_response,
    merge_dicts,
    safe_string,
    serialize,
    serialize_error,
)
from ibutsu_server.util.admin import validate_admin
from ibutsu_server.util.celery_task import IbutsuTask
from ibutsu_server.util.jwt import decode_token, generate_token
from ibutsu_server.util.projects import (
    add_user_filter,
    get_project,
    get_project_id,
    project_has_user,
)
from ibutsu_server.util.query import query_as_task
from ibutsu_server.util.redis_lock import get_redis_client, is_locked
from ibutsu_server.util.urls import build_url
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid
from ibutsu_server.util.widget import (
    create_basic_summary_columns,
    create_jenkins_columns,
    create_summary_columns,
    create_time_columns,
)

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


class TestDeserializePrimitive:
    """Tests for _deserialize_primitive function."""

    @pytest.mark.parametrize(
        ("data", "klass", "expected"),
        [
            ("123", int, 123),
            ("3.14", float, 3.14),
            ("hello", str, "hello"),
            (1, bool, True),
            (0, bool, False),
        ],
    )
    def test_deserialize_primitive_basic(self, data, klass, expected):
        """Test _deserialize_primitive with various types."""
        result = _deserialize_primitive(data, klass)
        assert result == expected

    def test_deserialize_primitive_unicode_error(self):
        """Test _deserialize_primitive handles UnicodeEncodeError."""
        # Create a mock class that raises UnicodeEncodeError
        mock_klass = MagicMock()
        mock_klass.side_effect = UnicodeEncodeError("utf-8", "test", 0, 1, "test")

        result = _deserialize_primitive("test", mock_klass)
        assert result == "test"

    def test_deserialize_primitive_type_error(self):
        """Test _deserialize_primitive handles TypeError."""
        mock_klass = MagicMock()
        mock_klass.side_effect = TypeError("test error")

        result = _deserialize_primitive("test", mock_klass)
        assert result == "test"


class TestDeserializeObject:
    """Tests for _deserialize_object function."""

    def test_deserialize_object_returns_value(self):
        """Test _deserialize_object returns the original value."""
        value = {"key": "value"}
        result = _deserialize_object(value)
        assert result is value

    def test_deserialize_object_with_list(self):
        """Test _deserialize_object with list."""
        value = [1, 2, 3]
        result = _deserialize_object(value)
        assert result is value


class TestDeserializeModel:
    """Tests for deserialize_model function."""

    def test_deserialize_model_with_empty_openapi_types(self):
        """Test deserialize_model when instance has no openapi_types."""
        mock_klass = MagicMock()
        mock_instance = MagicMock()
        mock_instance.openapi_types = None
        mock_klass.return_value = mock_instance

        result = deserialize_model({"key": "value"}, mock_klass)

        assert result == {"key": "value"}

    def test_deserialize_model_with_data(self):
        """Test deserialize_model with valid data."""
        mock_klass = MagicMock()
        mock_instance = MagicMock()
        mock_instance.openapi_types = {"name": str}
        mock_instance.attribute_map = {"name": "name"}
        mock_klass.return_value = mock_instance

        result = deserialize_model({"name": "test"}, mock_klass)

        assert result is mock_instance


class TestDeserializeList:
    """Tests for _deserialize_list function."""

    def test_deserialize_list_with_primitives(self):
        """Test _deserialize_list with primitive types."""
        result = _deserialize_list([1, 2, 3], int)
        assert result == [1, 2, 3]

    def test_deserialize_list_with_strings(self):
        """Test _deserialize_list with string types."""
        result = _deserialize_list(["a", "b", "c"], str)
        assert result == ["a", "b", "c"]


class TestDeserializeDict:
    """Tests for _deserialize_dict function."""

    def test_deserialize_dict_with_primitives(self):
        """Test _deserialize_dict with primitive types."""
        result = _deserialize_dict({"a": 1, "b": 2}, int)
        assert result == {"a": 1, "b": 2}

    def test_deserialize_dict_with_strings(self):
        """Test _deserialize_dict with string types."""
        result = _deserialize_dict({"key1": "val1", "key2": "val2"}, str)
        assert result == {"key1": "val1", "key2": "val2"}


class TestDeserialize:
    """Tests for the _deserialize function."""

    def test_deserialize_none(self):
        """Test _deserialize with None returns None."""
        result = _deserialize(None, str)
        assert result is None

    @pytest.mark.parametrize(
        ("data", "klass", "expected"),
        [
            ("123", int, 123),
            ("3.14", float, 3.14),
            ("hello", str, "hello"),
            (True, bool, True),
        ],
    )
    def test_deserialize_primitives(self, data, klass, expected):
        """Test _deserialize with primitive types."""
        result = _deserialize(data, klass)
        assert result == expected

    def test_deserialize_object_type(self):
        """Test _deserialize with object type."""
        data = {"key": "value"}
        result = _deserialize(data, object)
        assert result == data

    def test_deserialize_date(self):
        """Test _deserialize with date type."""
        result = _deserialize("2023-01-15", datetime.date)
        assert isinstance(result, datetime.date)

    def test_deserialize_datetime(self):
        """Test _deserialize with datetime type."""
        result = _deserialize("2023-01-15T12:30:45", datetime.datetime)
        assert isinstance(result, datetime.datetime)

    def test_deserialize_list_collection(self):
        """Test _deserialize with list collection type."""

        result = _deserialize([1, 2, 3], list[int])
        assert result == [1, 2, 3]

    def test_deserialize_dict_collection(self):
        """Test _deserialize with dict collection type."""

        result = _deserialize({"a": 1, "b": 2}, dict[str, int])
        assert result == {"a": 1, "b": 2}


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


# Tests for util/admin.py


class TestValidateAdmin:
    """Tests for the validate_admin decorator."""

    def test_validate_admin_with_superadmin(self, flask_app, make_user):
        """Test validate_admin decorator allows superadmin."""

        client, _ = flask_app

        with client.application.app_context():
            admin = make_user(email="admin@test.com", is_superadmin=True)

            @validate_admin
            def test_func(**kwargs):
                return "success"

            result = test_func(user=str(admin.id))
            assert result == "success"

    def test_validate_admin_with_regular_user(self, flask_app, make_user):
        """Test validate_admin decorator rejects non-superadmin."""
        client, _ = flask_app

        with client.application.app_context():
            regular_user = make_user(email="regular@test.com", is_superadmin=False)

            @validate_admin
            def test_func(**kwargs):
                return "success"

            with pytest.raises(Forbidden):
                test_func(user=str(regular_user.id))

    def test_validate_admin_with_nonexistent_user(self, flask_app):
        """Test validate_admin decorator rejects non-existent user."""
        client, _ = flask_app

        with client.application.app_context():

            @validate_admin
            def test_func(**kwargs):
                return "success"

            with pytest.raises(Unauthorized):
                test_func(user="00000000-0000-0000-0000-000000000000")


# Tests for util/query.py


class TestQueryAsTask:
    """Tests for query_as_task decorator."""

    def test_query_as_task_small_page_size(self, flask_app):
        """Test query_as_task runs function directly for small page sizes."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.query.query_task") as mock_query_task,
        ):
            mock_result = {"results": [], "pagination": {}}

            @query_as_task
            def get_result_list(**kwargs):
                return mock_result

            # page_size is intentionally small to stay below async threshold (MAX_PAGE_SIZE=500)
            result = get_result_list(page_size=25, page=1, filter_=None, estimate=False)

            # The function should execute synchronously and return the result
            assert result == mock_result
            # The Celery task must not be invoked for small page sizes
            mock_query_task.apply_async.assert_not_called()

    def test_query_as_task_large_page_size(self, flask_app):
        """Test query_as_task dispatches task for large page sizes with expected parameters."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.query.query_task") as mock_query_task,
        ):
            mock_async_result = MagicMock()
            mock_async_result.id = "test-task-id"
            mock_query_task.apply_async.return_value = mock_async_result

            @query_as_task
            def get_result_list(**kwargs):
                return {"results": []}

            # Use page_size above MAX_PAGE_SIZE (500) to trigger async behavior
            page = 3
            page_size = 600
            filter_list = ["result=passed", "project_id=test-123"]
            estimate = True

            result, status = get_result_list(
                page_size=page_size, page=page, filter_=filter_list, estimate=estimate
            )

            # Verify task was dispatched
            assert status == HTTPStatus.CREATED
            assert "task_id" in result
            assert result["task_id"] == "test-task-id"
            mock_query_task.apply_async.assert_called_once()

            # Verify the positional args passed to apply_async contain our parameters
            # The decorator passes (filter_, page, page_size, estimate, tablename)
            call_args = mock_query_task.apply_async.call_args
            positional_args = call_args[0][0]  # First arg to apply_async is a tuple

            assert positional_args[0] == filter_list, "filter_ should be passed to task"
            assert positional_args[1] == page, "page should be passed to task"
            assert positional_args[2] == page_size, "page_size should be passed to task"
            assert positional_args[3] == estimate, "estimate should be passed to task"
            # tablename is derived from function name "get_result_list" -> "results"
            assert positional_args[4] == "results", "tablename should be 'results'"

    def test_query_as_task_tablename_extraction(self, flask_app):
        """Test query_as_task extracts tablename from function name."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.query.query_task") as mock_query_task,
        ):
            mock_async_result = MagicMock()
            mock_async_result.id = "test-task-id"
            mock_query_task.apply_async.return_value = mock_async_result

            @query_as_task
            def get_run_list(**kwargs):
                return {"results": []}

            get_run_list(page_size=600, page=1)

            # Verify the tablename was correctly extracted as "runs" from "get_run_list"
            # Access args tuple and extract the tablename (last element) without relying on index
            call_args = mock_query_task.apply_async.call_args
            positional_args = call_args[0][0]
            # tablename is the last positional argument passed to the task
            tablename = positional_args[-1]
            assert tablename == "runs", (
                f"Expected tablename 'runs' derived from 'get_run_list', got '{tablename}'"
            )


# Tests for util/redis_lock.py


class TestRedisLock:
    """Tests for redis_lock module."""

    def test_is_locked_returns_true(self, flask_app):
        """Test is_locked returns True when lock exists."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.redis_lock.get_redis_client") as mock_redis,
        ):
            mock_client = MagicMock()
            mock_client.exists.return_value = True
            mock_redis.return_value = mock_client

            result = is_locked("test-lock")

            assert result is True
            mock_client.exists.assert_called_once_with("test-lock")

    def test_is_locked_returns_false(self, flask_app):
        """Test is_locked returns False when lock doesn't exist."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.redis_lock.get_redis_client") as mock_redis,
        ):
            mock_client = MagicMock()
            mock_client.exists.return_value = False
            mock_redis.return_value = mock_client

            result = is_locked("test-lock")

            assert result is False

    def test_get_redis_client_from_flask_app(self, flask_app):
        """Test get_redis_client uses provided Flask app."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.redis_lock.Redis") as mock_redis,
        ):
            mock_redis.from_url.return_value = MagicMock()

            get_redis_client(app=client.application)

            mock_redis.from_url.assert_called_once()


# Tests for util/uuid.py


class TestConvertObjectIdToUuid:
    """Tests for convert_objectid_to_uuid function."""

    def test_convert_objectid_to_uuid_string(self):
        """Test convert_objectid_to_uuid with ObjectId string."""
        # Valid ObjectId string
        object_id_str = "507f1f77bcf86cd799439011"
        result = convert_objectid_to_uuid(object_id_str)

        # Should return a valid UUID string - verify by parsing with uuid.UUID
        assert result is not None
        parsed_uuid = uuid.UUID(result)  # Raises ValueError if not a valid UUID
        assert str(parsed_uuid) == result, "Result should be a properly formatted UUID string"

    def test_convert_objectid_to_uuid_object(self):
        """Test convert_objectid_to_uuid with ObjectId object."""
        object_id = ObjectId("507f1f77bcf86cd799439011")
        result = convert_objectid_to_uuid(object_id)

        # Should return a valid UUID string - verify by parsing with uuid.UUID
        assert result is not None
        parsed_uuid = uuid.UUID(result)  # Raises ValueError if not a valid UUID
        assert str(parsed_uuid) == result, "Result should be a properly formatted UUID string"

    def test_convert_objectid_to_uuid_with_uuid_string(self):
        """Test convert_objectid_to_uuid with UUID string (no conversion)."""
        uuid_str = "507f1f77-bcf8-6cd7-9943-901100000000"
        result = convert_objectid_to_uuid(uuid_str)

        # Should return original UUID string unchanged
        assert result == uuid_str
        # Verify it's still a valid UUID
        parsed_uuid = uuid.UUID(result)
        assert str(parsed_uuid) == result

    def test_convert_objectid_to_uuid_with_invalid_input(self):
        """Test convert_objectid_to_uuid with non-ObjectId input."""

        # Should return input unchanged if not ObjectId
        result = convert_objectid_to_uuid(12345)
        assert result == 12345


class TestIsUuid:
    """Tests for is_uuid function."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("507f1f77-bcf8-6cd7-9943-901100000000", True),
            ("00000000-0000-0000-0000-000000000000", True),
            ("not-a-uuid", False),
            ("507f1f77bcf86cd799439011", False),  # ObjectId format
            ("", False),
        ],
    )
    def test_is_uuid(self, value, expected):
        """Test is_uuid with various inputs."""

        result = is_uuid(value)
        assert result == expected


class TestValidateUuid:
    """Tests for validate_uuid decorator."""

    def test_validate_uuid_valid(self):
        """Test validate_uuid allows valid UUIDs."""

        @validate_uuid
        def test_func(**kwargs):
            return "success"

        result = test_func(id_="507f1f77-bcf8-6cd7-9943-901100000000")
        assert result == "success"

    def test_validate_uuid_invalid(self):
        """Test validate_uuid rejects invalid UUIDs."""

        @validate_uuid
        def test_func(**kwargs):
            return "success"

        result = test_func(id_="not-a-valid-uuid")
        assert isinstance(result, tuple)
        assert result[1] == HTTPStatus.BAD_REQUEST
        assert "not a valid UUID" in result[0]


# Tests for util/widget.py


class TestWidgetUtils:
    """Tests for widget utility functions."""

    def test_create_summary_columns_with_table(self, flask_app):
        """Test create_summary_columns with Run table."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_summary_columns(Run)

            assert "source" in columns
            assert "failures" in columns
            assert "tests" in columns
            assert "min_start_time" in columns

    def test_create_summary_columns_with_subquery(self, flask_app):
        """Test create_summary_columns with subquery."""
        client, _ = flask_app

        with client.application.app_context():
            subquery = db.select(Run).subquery()
            columns = create_summary_columns(subquery)

            assert "source" in columns
            assert "failures" in columns

    def test_create_summary_columns_with_label_prefix(self, flask_app):
        """Test create_summary_columns with label prefix."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_summary_columns(Run, label_prefix="test_")

            # Verify labels have prefix
            assert columns["failures"] is not None

    def test_create_basic_summary_columns(self, flask_app):
        """Test create_basic_summary_columns function."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_basic_summary_columns(Run)

            assert "failures" in columns
            assert "tests" in columns
            assert "skips" in columns

    def test_create_basic_summary_columns_alternate_names(self, flask_app):
        """Test create_basic_summary_columns with alternate names."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_basic_summary_columns(Run, use_alternate_names=True)

            assert "xpassed" in columns
            assert "xfailed" in columns

    def test_create_time_columns(self, flask_app):
        """Test create_time_columns function."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_time_columns(Run)

            assert "min_start_time" in columns
            assert "max_start_time" in columns
            assert "total_execution_time" in columns
            assert "max_duration" in columns

    def test_create_time_columns_with_subquery(self, flask_app):
        """Test create_time_columns with subquery."""
        client, _ = flask_app

        with client.application.app_context():
            subquery = db.select(Run).subquery()
            columns = create_time_columns(subquery)

            assert "min_start_time" in columns

    def test_create_jenkins_columns(self, flask_app):
        """Test create_jenkins_columns function."""
        client, _ = flask_app

        with client.application.app_context():
            columns = create_jenkins_columns(Run)

            assert "job_name" in columns
            assert "build_number" in columns
            assert "build_url" in columns
            assert "annotations" in columns
            assert "env" in columns


# Tests for util/login.py additional coverage


# Tests for util/jwt.py


class TestJwtUtils:
    """Tests for JWT utility functions."""

    def test_generate_token_without_secret(self, flask_app):
        """Test generate_token raises error without JWT_SECRET."""

        client, _ = flask_app

        with client.application.app_context():
            # Remove JWT_SECRET from config
            original = client.application.config.get("JWT_SECRET")
            client.application.config["JWT_SECRET"] = None

            with pytest.raises(IbutsuError, match="JWT_SECRET"):
                generate_token("test-user-id")

            # Restore
            client.application.config["JWT_SECRET"] = original

    def test_decode_token_invalid(self, flask_app):
        """Test decode_token raises Unauthorized for invalid token."""

        client, _ = flask_app

        with client.application.app_context(), pytest.raises(Unauthorized):
            decode_token("invalid-token")


# Tests for util/celery_task.py


class TestIbutsuTask:
    """Tests for IbutsuTask class."""

    def test_after_return_commits_on_success(self, flask_app):
        """Test after_return commits session on successful task."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.celery_task.db") as mock_db,
        ):
            task = IbutsuTask()
            task.after_return("SUCCESS", "result", "task-id", (), {}, None)

            mock_db.session.commit.assert_called_once()
            mock_db.session.remove.assert_called_once()

    def test_after_return_does_not_commit_on_exception(self, flask_app):
        """Test after_return does not commit when retval is Exception."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.celery_task.db") as mock_db,
        ):
            task = IbutsuTask()
            task.after_return("FAILURE", Exception("error"), "task-id", (), {}, None)

            mock_db.session.commit.assert_not_called()
            mock_db.session.remove.assert_called_once()

    def test_after_return_handles_commit_error(self, flask_app):
        """Test after_return handles commit errors."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.celery_task.db") as mock_db,
        ):
            mock_db.session.commit.side_effect = Exception("Commit error")

            task = IbutsuTask()

            with pytest.raises(Exception, match="Commit error"):
                task.after_return("SUCCESS", "result", "task-id", (), {}, None)

            mock_db.session.rollback.assert_called_once()

    def test_on_failure_logs_error(self, flask_app):
        """Test on_failure logs error message."""

        client, _ = flask_app

        with (
            client.application.app_context(),
            patch("ibutsu_server.util.celery_task.logging") as mock_logging,
        ):
            task = IbutsuTask()
            task.on_failure(Exception("test"), "task-123", ["arg1"], {}, None)

            mock_logging.error.assert_called_once()
            call_args = mock_logging.error.call_args[0][0]
            assert "task-123" in call_args


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
