"""Tests for the filters module."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import Integer, String

from ibutsu_server.constants import ARRAY_FIELDS, NUMERIC_FIELDS
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

# NUMERIC_FIELDS that are stored as JSON sub-keys (summary.*).
# These go through the JSON path accessor in string_to_column and therefore
# receive an explicit as_integer() cast.  A non-numeric value stored in the
# database for any of these keys will raise a database error at query time
# rather than silently returning incorrect results.
_JSON_NUMERIC_FIELDS = [f for f in NUMERIC_FIELDS if f.startswith("summary.")]

# NUMERIC_FIELDS that map to native ORM columns (not JSON paths).
# These bypass the JSON accessor branch entirely, so as_integer() is never
# applied to them; their type is already enforced by the column definition.
_DIRECT_NUMERIC_FIELDS = [f for f in NUMERIC_FIELDS if not f.startswith("summary.")]


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


class TestStringToColumnCastSemantics:
    """Explicit coverage for the JSON-cast behavior introduced by as_integer() / as_string().

    The contract under test:
    - Every field listed in NUMERIC_FIELDS whose first segment is "summary" is
      accessed via the Run.summary JSONB column and then cast to Integer with
      as_integer().  This produces correct numeric ordering and matches the
      ::int expression index, but will raise a database-level error if a stored
      value cannot be cast to a number.
    - Non-numeric JSON fields (data.*, metadata.*, non-array summary.*) are
      cast to String via as_string(), preserving the previous text-comparison
      behaviour.
    - Array fields (metadata.tags etc.) receive neither cast; they remain raw
      JSON path expressions so that array operators (@>, ?|) work correctly.
    - Direct ORM columns (duration, start_time) never pass through the JSON
      accessor branch and are therefore unaffected by as_integer().
    """

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_json_numeric_fields_produce_integer_cast(self, app_ctx, field):
        """Every summary.* NUMERIC_FIELD must use an explicit Integer cast.

        Verifies that the as_integer() path is taken, meaning:
        1. Comparisons use numeric ordering, not lexicographic ordering.
        2. The cast matches the ::int expression index on ix_runs_pass_percent,
           allowing PostgreSQL to use an index scan for range filters.
        3. A row whose stored JSON value is not numeric will raise a database
           error at query time (not silently return wrong results).
        """
        column = string_to_column(field, Run)
        assert column is not None, f"string_to_column returned None for {field!r}"
        assert isinstance(column.type, Integer), (
            f"{field!r} expected an Integer-cast column (as_integer()) "
            f"but got type {type(column.type).__name__!r}. "
            "Check that this field is still listed in NUMERIC_FIELDS."
        )

    @pytest.mark.parametrize(
        ("field", "model"),
        [
            ("data.component", Result),
            ("data.env", Result),
            ("metadata.jenkins.job_name", Run),
            ("metadata.jenkins.build_url", Run),
        ],
    )
    def test_non_numeric_json_fields_produce_string_cast(self, app_ctx, field, model):
        """Non-numeric JSON fields must use a String cast, not a Float cast.

        This guards against accidentally adding a field to NUMERIC_FIELDS and
        breaking text-comparison filters on fields that hold string values.
        """
        column = string_to_column(field, model)
        assert column is not None, f"string_to_column returned None for {field!r}"
        assert isinstance(column.type, String), (
            f"{field!r} expected a String-cast column (as_string()) "
            f"but got type {type(column.type).__name__!r}."
        )
        assert not isinstance(column.type, Integer), (
            f"{field!r} must not be Integer-cast; it holds string values."
        )

    @pytest.mark.parametrize("field", ARRAY_FIELDS)
    def test_array_fields_are_not_scalar_cast(self, app_ctx, field):
        """Array fields must not receive a Float or String cast.

        Array comparisons use the @> and ?| JSON operators; casting to a scalar
        type first would make these operators unusable.
        """
        column = string_to_column(field, Run)
        assert column is not None, f"string_to_column returned None for {field!r}"
        assert not isinstance(column.type, Integer), (
            f"Array field {field!r} must not be Integer-cast."
        )
        assert not isinstance(column.type, String), (
            f"Array field {field!r} must not be String-cast."
        )

    @pytest.mark.parametrize("field", _DIRECT_NUMERIC_FIELDS)
    def test_direct_numeric_columns_bypass_json_accessor(self, app_ctx, field):
        """Direct ORM columns (duration, start_time) bypass the JSON path branch.

        These fields already have the correct DB type from the column definition
        and do not need an explicit JSON cast.  Verifying they resolve to a
        non-None column ensures they are not accidentally reclassified as JSON
        fields.
        """
        column = string_to_column(field, Run)
        assert column is not None, (
            f"string_to_column returned None for direct column {field!r}. "
            "If this field was moved to a JSON column, update this test."
        )
        # These are native ORM columns, not JSON path expressions, so they will
        # NOT be Integer instances from as_integer() — their type comes from the
        # SQLAlchemy column definition (Float for duration, DateTime for start_time).
        # We only assert the column resolves without error.

    def test_summary_pass_percent_uses_integer_cast(self, app_ctx):
        """Explicit regression test: summary.pass_percent must be Integer-cast.

        pass_percent is stored as a whole-number integer (0-100) and the
        expression index ix_runs_pass_percent is defined on
        ((summary->>'pass_percent')::int).  The query-side cast must be
        as_integer() so PostgreSQL can match the index expression and use an
        index scan for range filters instead of a sequential scan.
        """
        column = string_to_column("summary.pass_percent", Run)
        assert column is not None
        assert isinstance(column.type, Integer), (
            "summary.pass_percent must produce an Integer cast so that "
            "percentage comparisons use numeric ordering and the expression "
            "index ix_runs_pass_percent can be used."
        )


class TestConvertFilterNumericFieldSemantics:
    """Tests for the numeric comparison semantics of convert_filter on JSON fields.

    The as_integer() cast on NUMERIC_FIELDS means:
    - Comparison operators (>, <, >=, <=) behave with numeric ordering.
    - The cast matches the ::int expression indexes, allowing PostgreSQL to use
      index scans for range filters rather than sequential scans.
    - The filter value is also converted to int/float by _to_int_or_float.
    - Rows with non-numeric JSON values for these keys will produce a database
      error at query time.
    """

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_equality_filter(self, app_ctx, field):
        """convert_filter must produce a non-None clause for equality on JSON numeric fields."""
        result = convert_filter(f"{field}=10", Run)
        assert result is not None, f"convert_filter returned None for equality filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_greater_than_filter(self, app_ctx, field):
        """Numeric JSON fields must support greater-than comparisons."""
        result = convert_filter(f"{field}>5", Run)
        assert result is not None, f"convert_filter returned None for '>' filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_less_than_filter(self, app_ctx, field):
        """Numeric JSON fields must support less-than comparisons."""
        result = convert_filter(f"{field}<100", Run)
        assert result is not None, f"convert_filter returned None for '<' filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_gte_filter(self, app_ctx, field):
        """Numeric JSON fields must support greater-than-or-equal comparisons via ')'.

        ')' is the compact encoding the frontend generates for every gte filter
        (see NUMERIC_OPERATIONS.gte.opChar in frontend/src/constants.js).
        """
        result = convert_filter(f"{field})0", Run)
        assert result is not None, f"convert_filter returned None for ')' (>=) filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_lte_filter(self, app_ctx, field):
        """Numeric JSON fields must support less-than-or-equal comparisons via '('.

        '(' is the compact encoding the frontend generates for every lte filter
        (see NUMERIC_OPERATIONS.lte.opChar in frontend/src/constants.js).
        """
        result = convert_filter(f"{field}(50", Run)
        assert result is not None, f"convert_filter returned None for '(' (<=) filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_gte_operator_filter(self, app_ctx, field):
        """Numeric JSON fields must also support the explicit '>=' operator syntax.

        '>=' is accepted alongside ')' for direct/human API callers (curl, docs,
        tests) that use conventional operator syntax instead of the frontend's
        compact encoding. Both must resolve to the same $gte comparison.
        """
        result = convert_filter(f"{field}>=0", Run)
        assert result is not None, f"convert_filter returned None for '>=' filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_lte_operator_filter(self, app_ctx, field):
        """Numeric JSON fields must also support the explicit '<=' operator syntax.

        '<=' is accepted alongside '(' for direct/human API callers (curl, docs,
        tests) that use conventional operator syntax instead of the frontend's
        compact encoding. Both must resolve to the same $lte comparison.
        """
        result = convert_filter(f"{field}<=50", Run)
        assert result is not None, f"convert_filter returned None for '<=' filter on {field!r}"

    @pytest.mark.parametrize("field", _JSON_NUMERIC_FIELDS)
    def test_numeric_json_field_not_equal_filter(self, app_ctx, field):
        """Numeric JSON fields must support not-equal comparisons and cast values to int."""
        result = convert_filter(f"{field}!0", Run)
        assert result is not None, f"convert_filter returned None for '!' filter on {field!r}"

        # Ensure the bound parameter value is actually an int(0), not the string "0"
        right = getattr(result, "right", None)
        assert right is not None, "Expected filter expression to have a .right side"
        value = getattr(right, "value", None)
        assert isinstance(value, int), (
            f"Expected numeric JSON filter value for {field!r} to be int(0), "
            f"got {value!r} ({type(value)})"
        )
        assert value == 0, (
            f"Expected numeric JSON filter value for {field!r} to be int(0), "
            f"got {value!r} ({type(value)})"
        )

    def test_numeric_value_is_converted_to_int_for_integer_string(self, app_ctx):
        """Numeric field values supplied as integer strings are cast to int, not kept as str."""
        # summary.failures is a NUMERIC_FIELD; value "3" should be converted to int(3)
        result = convert_filter("summary.failures=3", Run)
        assert result is not None

        # Ensure the bound parameter value is actually an int(3), not the string "3"
        right = getattr(result, "right", None)
        assert right is not None, "Expected filter expression to have a .right side"
        value = getattr(right, "value", None)
        assert isinstance(value, int), (
            "Expected numeric filter value for 'summary.failures' to be int(3), "
            f"got {value!r} ({type(value)})"
        )
        assert value == 3, (
            "Expected numeric filter value for 'summary.failures' to be int(3), "
            f"got {value!r} ({type(value)})"
        )

    def test_numeric_value_is_converted_to_int_for_integer_percent_string(self, app_ctx):
        """pass_percent filter values supplied as integer strings are cast to int.

        pass_percent is always stored as a whole number (0-100), so integer
        filter values are the correct and expected input.
        """
        result = convert_filter("summary.pass_percent=99", Run)
        assert result is not None

        # Ensure the bound parameter value is actually an int(99), not the string "99"
        right = getattr(result, "right", None)
        assert right is not None, "Expected filter expression to have a .right side"
        value = getattr(right, "value", None)
        assert isinstance(value, int), (
            "Expected numeric filter value for 'summary.pass_percent' to be int(99), "
            f"got {value!r} ({type(value)})"
        )
        assert value == 99, (
            "Expected numeric filter value for 'summary.pass_percent' to be int(99), "
            f"got {value!r} ({type(value)})"
        )

    def test_non_numeric_string_value_on_numeric_field_is_kept_as_str(self, app_ctx):
        """A non-numeric string value for a NUMERIC_FIELD stays as a string.

        This exercises the _to_int_or_float fallback.  The database will still
        apply the as_integer() cast to the column side; the right-hand string
        value will be passed through as-is and may cause a type-mismatch error
        at query execution time.  The purpose here is to verify no exception is
        raised at filter *construction* time.
        """
        result = convert_filter("summary.failures=not_a_number", Run)
        assert result is not None, (
            "Filter construction must not raise even if the value is non-numeric; "
            "type errors surface only when the query is executed against the database."
        )

    def test_summary_pass_percent_range_filter(self, app_ctx):
        """Regression: summary.pass_percent supports range comparisons after Integer cast."""
        above = convert_filter("summary.pass_percent)80", Run)
        below = convert_filter("summary.pass_percent(100", Run)
        assert above is not None, "Lower-bound filter on summary.pass_percent must not be None"
        assert below is not None, "Upper-bound filter on summary.pass_percent must not be None"


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
        """Test convert_filter with the legacy ')' greater-than-or-equal operator."""
        result = convert_filter("duration)10", Result)
        assert result is not None

    def test_convert_filter_lte_operator(self, app_ctx):
        """Test convert_filter with the legacy '(' less-than-or-equal operator."""
        result = convert_filter("duration(100", Result)
        assert result is not None

    def test_convert_filter_gte_operator_standard_syntax(self, app_ctx):
        """Test convert_filter with the explicit '>=' greater-than-or-equal operator."""
        result = convert_filter("duration>=10", Result)
        assert result is not None

    def test_convert_filter_lte_operator_standard_syntax(self, app_ctx):
        """Test convert_filter with the explicit '<=' less-than-or-equal operator."""
        result = convert_filter("duration<=100", Result)
        assert result is not None

    def test_convert_filter_gte_spellings_are_equivalent(self, app_ctx):
        """')' and '>=' must produce an identical comparison, not just a non-None result.

        Both spellings are documented in OPERATORS/OPER_COMPARE as aliases of the
        same $gte comparison; this guards against the two definitions drifting
        apart (e.g. one accidentally becoming '>' instead of '>=').
        """
        legacy = convert_filter("duration)10", Result)
        standard = convert_filter("duration>=10", Result)
        assert str(legacy) == str(standard)

    def test_convert_filter_lte_spellings_are_equivalent(self, app_ctx):
        """'(' and '<=' must produce an identical comparison, not just a non-None result.

        Both spellings are documented in OPERATORS/OPER_COMPARE as aliases of the
        same $lte comparison; this guards against the two definitions drifting
        apart (e.g. one accidentally becoming '<' instead of '<=').
        """
        legacy = convert_filter("duration(100", Result)
        standard = convert_filter("duration<=100", Result)
        assert str(legacy) == str(standard)

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

    @pytest.mark.parametrize(
        "filter_string",
        [
            "bogus_field=value",
            "bogus_field>10",
            "bogus_field<100",
            "bogus_field~pattern",
            "bogus_field!value",
            "bogus_field%value",
            "bogus_field@yes",
        ],
    )
    def test_convert_filter_unknown_field_returns_none(self, app_ctx, filter_string):
        """convert_filter must return None for fields that string_to_column cannot resolve."""
        result = convert_filter(filter_string, Result)
        assert result is None


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
