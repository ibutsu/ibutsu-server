from datetime import timedelta
from math import ceil

from jinja2 import Environment, PackageLoader, select_autoescape


def pretty_duration(duration):
    """Make a pretty duration (like 00:05)"""
    return str(timedelta(seconds=ceil(duration)))


def render_template(name, **context):
    """Render a template"""
    env = Environment(
        loader=PackageLoader("ibutsu_server", "templates"),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["pretty_duration"] = pretty_duration
    template = env.get_template(name)
    return template.render(**context)
