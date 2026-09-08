import re
from contextlib import suppress

from sqlalchemy import Text, cast
from sqlalchemy.dialects.postgresql import array

from ibutsu_server.constants import ARRAY_FIELDS, FLOAT_FIELDS, INTEGER_FIELDS, NUMERIC_FIELDS
from ibutsu_server.db.types import PortableUUID

# gte/lte each have two operator spellings, and both are actively used (not
# legacy/deprecated):
#   - ")" / "(" are the single-character encoding the frontend generates for
#     every filter it builds (see NUMERIC_OPERATIONS.opChar in
#     frontend/src/constants.js), because ">" and "<" require URL-encoding
#     inside query-string values while ")"/"(" don't.
#   - ">=" / "<=" are accepted so the API also matches conventional operator
#     syntax for direct/human API callers (curl, docs, tests) who don't go
#     through the frontend's compact encoding.
# Both must keep working; removing either would break existing callers.
OPERATORS = {
    "=": "$eq",
    "!": "$ne",
    ">=": "$gte",
    "<=": "$lte",
    ">": "$gt",
    ")": "$gte",
    "<": "$lt",
    "(": "$lte",
    "~": "$regex",
    "*": "$in",
    "%": "$ilike",
    "@": "$exists",
}
OPER_COMPARE = {
    "=": lambda column, value: column == value,
    "!": lambda column, value: column != value,
    ">=": lambda column, value: column >= value,
    "<=": lambda column, value: column <= value,
    ">": lambda column, value: column > value,
    "<": lambda column, value: column < value,
    ")": lambda column, value: column >= value,
    "(": lambda column, value: column <= value,
    "*": lambda column, value: column.in_(value),
    "~": lambda column, value: column.op("~")(value),
    "%": lambda column, value: column.ilike("%" + value + "%"),
}
FIELD_RE_PATTERN = r"[a-zA-Z0-9._-]+"
_OPERATOR_PATTERN = "|".join(
    re.escape(op) for op in sorted(OPERATORS.keys(), key=len, reverse=True)
)
FILTER_RE = re.compile(r"(" + FIELD_RE_PATTERN + r")(" + _OPERATOR_PATTERN + r")(.*)")
FLOAT_RE = re.compile(r"[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?")
VERSION_RE = re.compile("([0-9].*[0-9])")


def _to_int_or_float(value):
    """To reduce cognitive complexity"""
    if value.isdigit():
        # Try to typecast if we get a digit
        with suppress(ValueError, TypeError):
            value = int(value)
    elif FLOAT_RE.match(value):
        # Lastly, try to convert to a float
        with suppress(ValueError, TypeError):
            value = float(value)
    return value


def _null_compare(column, value):
    """To reduce cognitive complexity"""
    if value[0].lower() in ["y", "t", "1"]:
        return column != None  # noqa
    return column == None  # noqa


def _array_compare(oper, column, value):
    """To reduce cognitive complexity"""
    if oper == "=":
        return column.op("@>")(value)
    if oper == "*":
        return column.op("?|")(array(value))
    return None


def string_to_column(field, model):
    """Convert a field string to a SQLAlchemy column object.

    Handles JSON sub-keys (data.*, metadata.*, summary.*) with explicit typing:
    - INTEGER_FIELDS (e.g. summary.pass_percent) are cast to Integer with
      as_integer() to match integer expression indexes (e.g. ix_runs_pass_percent).
    - FLOAT_FIELDS (e.g. summary count fields like summary.tests, summary.failures)
      are cast to Float with as_float(), allowing both integer and float JSON
      representations (such as 3.0 or 0.0) without query-time cast errors.
    - Other non-array JSON fields are cast to String with as_string().
    - ARRAY_FIELDS remain raw JSON path expressions for array containment operators.
    - Direct ORM columns (e.g. duration, start_time in DIRECT_NUMERIC_FIELDS)
      are accessed directly via model attributes.
    """
    field_parts = field.split(".")

    # For subqueries, access columns directly via .c
    column_ref = model if not hasattr(model, "c") else model.c

    if field_parts[0] in ["data", "metadata", "summary"]:
        column = column_ref.summary if field_parts[0] == "summary" else column_ref.data

        for idx, part in enumerate(field_parts):
            if idx == 0:
                continue
            column = column[part]

        # Cast JSON fields based on type category:
        # - INTEGER_FIELDS: cast to Integer with as_integer() to match expression indexes
        # - FLOAT_FIELDS: cast to Float with as_float() to support numeric ordering and handle
        #   both integer and float representations (e.g. 3.0 or 0.0)
        # - Non-array scalar fields: cast to String with as_string() for text comparison
        if field in INTEGER_FIELDS:
            column = column.as_integer()
        elif field in FLOAT_FIELDS:
            column = column.as_float()
        elif field not in ARRAY_FIELDS:
            column = column.as_string()
    else:
        try:
            column = getattr(column_ref, field)
        except AttributeError:
            return None
    return column


def apply_filters(query, filter_list, model):
    """Given a list of filters and a query object, applies the filters to the query."""
    for filter_string in filter_list:
        filter_clause = convert_filter(filter_string, model)
        if filter_clause is not None:
            query = query.where(filter_clause)
    return query


def has_project_filter(filter_list):
    """Check if any filter in the list filters by project_id or data.project.

    :param filter_list: List of filter strings
    :return: True if a project filter exists, False otherwise
    """
    if not filter_list:
        return False

    for filter_string in filter_list:
        match = FILTER_RE.match(filter_string)
        if match:
            field = match.group(1)
            # Check for project_id or metadata.project filters
            if field in {"project_id", "data.project", "metadata.project"}:
                return True
    return False


def convert_filter(filter_string, model):
    match = FILTER_RE.match(filter_string)
    if not match:
        return None
    field = match.group(1)
    oper = match.group(2)
    value = match.group(3).strip('"')
    is_version = VERSION_RE.match(value) is not None
    column = string_to_column(field, model)
    if column is None:
        # Unknown/invalid field -- return None so apply_filters skips the
        # clause instead of producing a 500 or an accidental boolean filter.
        return None
    # determine if the field is an array field, if so it requires some additional care
    is_array_field = field in ARRAY_FIELDS
    # Do some type casting
    if oper == "@":
        return _null_compare(column, value)
    if oper == "*":
        value = value.split(";")
    elif field in NUMERIC_FIELDS or (not is_version and "build_number" not in field):
        # Always convert for numeric fields; version-like strings and Jenkins build numbers
        # are kept as strings because they need string comparison semantics.
        value = _to_int_or_float(value)
    if is_array_field:
        return _array_compare(oper, column, value)
    # Cast UUID columns to text when using regex operator to avoid UUID validation errors
    if oper == "~" and isinstance(column.type, PortableUUID):
        column = cast(column, Text)
    return OPER_COMPARE[oper](column, value)
