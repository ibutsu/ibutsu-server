from http import HTTPStatus
from typing import Any
from uuid import UUID

def is_uuid(candidate):
    """Determine if this is a uuid"""
    if not candidate:
        return False
    try:
        UUID(str(candidate))
        return True
    except ValueError:
        return False


def validate_uuid(function):
    def validate(**kwargs):
        candidate = kwargs.get("id_")
        if not is_uuid(candidate):
            return f"ID: {candidate} is not a valid UUID", HTTPStatus.BAD_REQUEST
        return function(**kwargs)

    return validate
