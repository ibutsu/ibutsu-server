import json


def jsonify(value):
    """PostgreSQL's JSON requires a JSON string, but Python strings are not correctly translated"""
    if isinstance(value, str):
        return '"{}"'.format(value)
    else:
        return json.dumps(value)
