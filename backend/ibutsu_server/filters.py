import re

from ibutsu_server.constants import ARRAY_FIELDS
from ibutsu_server.constants import NUMERIC_FIELDS
from sqlalchemy.dialects.postgresql import array

OPERATORS = {
    "=": "$eq",
    "!": "$ne",
    ">": "$gt",
    ")": "$gte",
    "<": "$lt",
    "(": "$lte",
    "~": "$regex",
    "*": "$in",
    "@": "$exists",
}

FILTER_RE = re.compile(r"([a-zA-Z\._]+)([" + "".join(OPERATORS.keys()) + "])(.*)")


def string_to_column(field, model):
    field_parts = field.split(".")
    if field_parts[0] == "data" or field_parts[0] == "metadata" or field_parts[0] == "summary":
        if field_parts[0] == "summary":
            column = model.summary
        else:
            column = model.data
        for idx, part in enumerate(field_parts):
            if idx == 0:
                continue
            column = column[part]
        if field not in ARRAY_FIELDS and field not in NUMERIC_FIELDS:
            column = column.as_string()
    else:
        column = getattr(model, field)
    return column


def apply_filters(query, filter_list, model):
    """Given a list of filters and a query object, applies the filters to the query."""
    for filter_string in filter_list:
        filter_clause = convert_filter(filter_string, model)
        if filter_clause is not None:
            query = query.filter(filter_clause)
    return query


def convert_filter(filter_string, model):
    match = FILTER_RE.match(filter_string)
    if not match:
        return None
    field = match.group(1)
    oper = match.group(2)
    value = match.group(3).strip('"')
    # determine if the field is an array field, if so it requires some additional care
    is_array_field = field in ARRAY_FIELDS
    # Do some type casting
    if oper == "@":
        # Need to typecast the value for the $exists operation
        if value[0].lower() in ["y", "t", "1"]:
            value = True
        else:
            value = False
    elif oper == "*":
        value = value.split(";")
    elif "build_number" not in field:
        # This is a horrible hack, because Jenkins build numbers are strings :-(
        if value.isdigit():
            # Try to typecast if we get a digit
            try:
                value = int(value)
            except (ValueError, TypeError):
                # Just ignore it and carry on if there's a problem
                pass
        else:
            # Lastly, try to convert to a float
            try:
                value = float(value)
            except (ValueError, TypeError):
                # Just ignore it and carry on
                pass

    column = string_to_column(field, model)

    if oper == "@":
        if value:
            return column != None  # noqa
        else:
            return column == None  # noqa

    if is_array_field:
        if oper == "=":
            return column.op("@>")(value)
        if oper == "*":
            return column.op("?|")(array(value))
    else:
        if oper == "=":
            return column == value
        if oper == "!":
            return column != value
        if oper == ">":
            return column > value
        if oper == "<":
            return column < value
        if oper == ")":
            return column >= value
        if oper == "(":
            return column <= value
        if oper == "*":
            return column.in_(value)
        if oper == "~":
            return column.op("~")(value)
    return None
