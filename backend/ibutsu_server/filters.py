import re
from contextlib import suppress

from sqlalchemy import Text, cast
from sqlalchemy.dialects.postgresql import array

from ibutsu_server.constants import ARRAY_FIELDS, NUMERIC_FIELDS
from ibutsu_server.db.types import PortableUUID

OPERATORS = {
    "=": "$eq",
    "!": "$ne",
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
    ">": lambda column, value: column > value,
    "<": lambda column, value: column < value,
    ")": lambda column, value: column >= value,
    "(": lambda column, value: column <= value,
    "*": lambda column, value: column.in_(value),
    "~": lambda column, value: column.op("~")(value),
    "%": lambda column, value: column.ilike("%" + value + "%"),
}
FILTER_RE = re.compile(r"([a-zA-Z\._]+)([" + "".join(OPERATORS.keys()) + "])(.*)")
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
    field_parts = field.split(".")

    # For subqueries, access columns directly via .c
    column_ref = model if not hasattr(model, "c") else model.c

    if field_parts[0] in ["data", "metadata", "summary"]:
        if field_parts[0] == "summary":
            column = column_ref.summary
        else:
            column = column_ref.data

        for idx, part in enumerate(field_parts):
            if idx == 0:
                continue
            column = column[part]

        if field not in ARRAY_FIELDS and field not in NUMERIC_FIELDS:
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
    # determine if the field is an array field, if so it requires some additional care
    is_array_field = field in ARRAY_FIELDS
    # Do some type casting
    if oper == "@":
        return _null_compare(column, value)
    if oper == "*":
        value = value.split(";")
    elif not is_version and "build_number" not in field:
        # This is a horrible hack, because Jenkins build numbers are strings :-(
        value = _to_int_or_float(value)
    if is_array_field:
        return _array_compare(oper, column, value)
    # Cast UUID columns to text when using regex operator to avoid UUID validation errors
    if oper == "~" and isinstance(column.type, PortableUUID):
        column = cast(column, Text)
    return OPER_COMPARE[oper](column, value)
