"""Tests for the filters module."""

from unittest.mock import MagicMock

import pytest

from ibutsu_server.db import db
from ibutsu_server.db.models import Result, Run
from ibutsu_server.filters import (
    _array_compare,
    _null_compare,
    _to_int_or_float,
    apply_filters,
    convert_filter,
    has_project_filter,
    string_to_column,
)


@pytest.fixture
def app_ctx(flask_app):
    """Provide an application context for filter tests.

    This fixture enters the Flask app context and yields the client,
    eliminating repetitive context manager usage in tests.
    """
    client, _ = flask_app
    with client.application.app_context():
        yield client


class TestToIntOrFloat:
    """Tests for the _to_int_or_float helper function."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("123", 123),  # Integer string
            ("0", 0),  # Zero
            ("999999", 999999),  # Large integer
        ],
    )
    def test_to_int_or_float_integer(self, value, expected):
        """Test _to_int_or_float with integer values."""
        result = _to_int_or_float(value)
        assert result == expected
        assert isinstance(result, int)

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("3.14", 3.14),  # Simple float
            ("0.5", 0.5),  # Decimal < 1
            (".5", 0.5),  # Leading decimal
            ("1e10", 1e10),  # Scientific notation
            ("2.5e-3", 2.5e-3),  # Scientific with negative exponent
            ("+3.14", 3.14),  # Positive sign
            ("-2.5", -2.5),  # Negative float
        ],
    )
    def test_to_int_or_float_float(self, value, expected):
        """Test _to_int_or_float with float values."""
        result = _to_int_or_float(value)
        assert result == pytest.approx(expected)
        assert isinstance(result, float)

    @pytest.mark.parametrize(
        "value",
        [
            "abc",  # Text
            "test123",  # Mixed
            "1.2.3",  # Invalid float
            "",  # Empty string
        ],
    )
    def test_to_int_or_float_string(self, value):
        """Test _to_int_or_float with non-numeric strings."""
        result = _to_int_or_float(value)
        assert result == value
        assert isinstance(result, str)


class TestNullCompare:
    """Tests for the _null_compare helper function."""

    @pytest.mark.parametrize(
        "value",
        [
            "yes",
            "Yes",
            "YES",
            "true",
            "True",
            "TRUE",
            "1",
        ],
    )
    def test_null_compare_true_values(self, value):
        """Test _null_compare with values that indicate column should exist."""
        mock_column = MagicMock()
        result = _null_compare(mock_column, value)
        # Should return column != None (exists check)
        assert result is not None

    @pytest.mark.parametrize(
        "value",
        [
            "no",
            "No",
            "NO",
            "false",
            "False",
            "FALSE",
            "0",
            "anything",
        ],
    )
    def test_null_compare_false_values(self, value):
        """Test _null_compare with values that indicate column should be null."""
        mock_column = MagicMock()
        result = _null_compare(mock_column, value)
        # Should return column == None (null check)
        assert result is not None


class TestArrayCompare:
    """Tests for the _array_compare helper function."""

    def test_array_compare_equals_operator(self):
        """Test _array_compare with equals operator."""
        mock_column = MagicMock()
        mock_column.op.return_value = lambda v: f"contains_{v}"

        result = _array_compare("=", mock_column, ["value1", "value2"])

        mock_column.op.assert_called_once_with("@>")
        assert result is not None

    def test_array_compare_in_operator(self):
        """Test _array_compare with in operator."""
        mock_column = MagicMock()
        mock_column.op.return_value = lambda v: f"overlaps_{v}"

        result = _array_compare("*", mock_column, ["value1", "value2"])

        mock_column.op.assert_called_once_with("?|")
        assert result is not None

    @pytest.mark.parametrize("oper", ["!", ">", "<", ")", "(", "~", "%", "@"])
    def test_array_compare_unsupported_operators(self, oper):
        """Test _array_compare with unsupported operators returns None."""
        mock_column = MagicMock()

        result = _array_compare(oper, mock_column, ["value"])

        assert result is None


class TestStringToColumn:
    """Tests for string_to_column function."""

    def test_string_to_column_simple_field(self, app_ctx):
        """Test string_to_column with a simple field name."""
        column = string_to_column("result", Result)
        assert column is not None

    def test_string_to_column_data_field(self, app_ctx):
        """Test string_to_column with data.* field."""
        column = string_to_column("data.component", Result)
        assert column is not None

    def test_string_to_column_metadata_field(self, app_ctx):
        """Test string_to_column with metadata.* field."""
        column = string_to_column("metadata.jenkins.job_name", Run)
        assert column is not None

    def test_string_to_column_summary_field(self, app_ctx):
        """Test string_to_column with summary.* field."""
        column = string_to_column("summary.failures", Run)
        assert column is not None

    def test_string_to_column_invalid_field(self, app_ctx):
        """Test string_to_column with non-existent field returns None."""
        column = string_to_column("nonexistent_field", Result)
        assert column is None

    def test_string_to_column_with_subquery(self, app_ctx):
        """Test string_to_column with a subquery."""
        subquery = db.select(Run).subquery()
        column = string_to_column("env", subquery)
        assert column is not None


class TestConvertFilter:
    """Tests for the convert_filter function."""

    def test_convert_filter_invalid_format(self, app_ctx):
        """Test convert_filter with invalid filter format."""
        result = convert_filter("invalid_filter_no_operator", Result)
        assert result is None

    def test_convert_filter_equals_operator(self, app_ctx):
        """Test convert_filter with equals operator."""
        result = convert_filter("result=passed", Result)
        assert result is not None

    def test_convert_filter_not_equals_operator(self, app_ctx):
        """Test convert_filter with not equals operator."""
        result = convert_filter("result!failed", Result)
        assert result is not None

    def test_convert_filter_greater_than_operator(self, app_ctx):
        """Test convert_filter with greater than operator."""
        result = convert_filter("duration>10", Result)
        assert result is not None

    def test_convert_filter_less_than_operator(self, app_ctx):
        """Test convert_filter with less than operator."""
        result = convert_filter("duration<100", Result)
        assert result is not None

    def test_convert_filter_gte_operator(self, app_ctx):
        """Test convert_filter with greater than or equal operator."""
        result = convert_filter("duration)10", Result)
        assert result is not None

    def test_convert_filter_lte_operator(self, app_ctx):
        """Test convert_filter with less than or equal operator."""
        result = convert_filter("duration(100", Result)
        assert result is not None

    def test_convert_filter_in_operator(self, app_ctx):
        """Test convert_filter with in operator."""
        result = convert_filter("result*passed;failed;skipped", Result)
        assert result is not None

    def test_convert_filter_regex_operator(self, app_ctx):
        """Test convert_filter with regex operator."""
        result = convert_filter("test_id~.*test.*", Result)
        assert result is not None

    def test_convert_filter_ilike_operator(self, app_ctx):
        """Test convert_filter with ilike operator."""
        result = convert_filter("test_id%test", Result)
        assert result is not None

    def test_convert_filter_exists_operator_true(self, app_ctx):
        """Test convert_filter with exists operator (true value)."""
        result = convert_filter("test_id@yes", Result)
        assert result is not None

    def test_convert_filter_exists_operator_false(self, app_ctx):
        """Test convert_filter with exists operator (false value)."""
        result = convert_filter("test_id@no", Result)
        assert result is not None

    def test_convert_filter_with_version_string(self, app_ctx):
        """Test convert_filter with version string (should not convert to number)."""
        result = convert_filter("data.version=1.2.3", Run)
        assert result is not None

    def test_convert_filter_with_build_number(self, app_ctx):
        """Test convert_filter with build_number field (special handling)."""
        result = convert_filter("metadata.jenkins.build_number=123", Run)
        assert result is not None

    def test_convert_filter_regex_on_uuid_column(self, app_ctx):
        """Test convert_filter with regex on UUID column (should cast to text)."""
        result = convert_filter("id~.*abc.*", Result)
        assert result is not None

    def test_convert_filter_array_field_equals(self, app_ctx):
        """Test convert_filter with array field and equals operator."""
        result = convert_filter("metadata.tags=tag1", Run)
        assert result is not None

    def test_convert_filter_array_field_in(self, app_ctx):
        """Test convert_filter with array field and in operator."""
        result = convert_filter("metadata.tags*tag1;tag2", Run)
        assert result is not None

    def test_convert_filter_with_quoted_value(self, app_ctx):
        """Test convert_filter with quoted value."""
        result = convert_filter('result="passed"', Result)
        assert result is not None


class TestApplyFilters:
    """Tests for the apply_filters function."""

    def test_apply_filters_single_filter(self, app_ctx):
        """Test apply_filters with a single filter."""
        query = db.select(Result)
        filtered = apply_filters(query, ["result=passed"], Result)
        assert filtered is not None

    def test_apply_filters_multiple_filters(self, app_ctx):
        """Test apply_filters with multiple filters."""
        query = db.select(Result)
        filters = ["result=passed", "duration>0"]
        filtered = apply_filters(query, filters, Result)
        assert filtered is not None

    def test_apply_filters_empty_list(self, app_ctx):
        """Test apply_filters with empty filter list."""
        query = db.select(Result)
        filtered = apply_filters(query, [], Result)
        assert filtered is not None

    def test_apply_filters_invalid_filter_skipped(self, app_ctx):
        """Test apply_filters skips invalid filters."""
        query = db.select(Result)
        # Mix of valid and invalid filters
        filters = ["result=passed", "invalid_filter", "duration>0"]
        filtered = apply_filters(query, filters, Result)
        assert filtered is not None


class TestHasProjectFilter:
    """Tests for the has_project_filter function."""

    def test_has_project_filter_with_project_id(self):
        """Test that project_id filter is detected."""
        filters = ["project_id=abc123"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_data_project(self):
        """Test that data.project filter is detected."""
        filters = ["data.project=my-project"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_metadata_project(self):
        """Test that metadata.project filter is detected."""
        filters = ["metadata.project=my-project"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_multiple_filters(self):
        """Test that project filter is detected among multiple filters."""
        filters = ["result=passed", "project_id=abc123", "test_id~example"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_without_project_filter(self):
        """Test that absence of project filter is detected."""
        filters = ["result=passed", "test_id~example"]
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_empty_list(self):
        """Test that empty filter list returns False."""
        filters = []
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_none(self):
        """Test that None filter list returns False."""
        filters = None
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_different_operators(self):
        """Test that project filter with different operators is detected."""
        assert has_project_filter(["project_id=abc"]) is True
        assert has_project_filter(["project_id!abc"]) is True
        assert has_project_filter(["project_id~abc"]) is True
        assert has_project_filter(["project_id*abc;def"]) is True

    def test_has_project_filter_with_similar_field_names(self):
        """Test that only exact project field matches are detected."""
        # These should not match
        assert has_project_filter(["my_project_id=abc"]) is False
        assert has_project_filter(["data.myproject=abc"]) is False
        assert has_project_filter(["project=abc"]) is False
