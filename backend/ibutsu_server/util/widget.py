"""
Shared utility functions for widget query construction.

This module provides common helper functions for building SQLAlchemy queries
across different widget modules, reducing code duplication and ensuring
consistent query patterns.
"""

from sqlalchemy import func

from ibutsu_server.db.base import Integer


def create_summary_columns(data_source, cast_type=Integer, label_prefix=""):
    """Helper function to create standardized summary aggregation columns

    :param data_source: The table or column reference (Run table or subquery.c)
    :param cast_type: The SQLAlchemy type to cast to (Integer or Float)
    :param label_prefix: Optional prefix for column labels
    :return: Dictionary of summary column expressions
    """
    if hasattr(data_source, "c"):  # It's a subquery
        summary_ref = data_source.c.summary
        source_ref = data_source.c.source
        time_ref = data_source.c.start_time
        duration_ref = data_source.c.duration
    else:  # It's the Run table
        summary_ref = data_source.summary
        source_ref = data_source.source
        time_ref = data_source.start_time
        duration_ref = data_source.duration

    # Create label helper
    def make_label(name):
        return f"{label_prefix}{name}" if label_prefix else name

    return {
        "source": func.min(source_ref).label(make_label("source")),
        "xfailures": func.sum(summary_ref["xfailures"].cast(cast_type)).label(
            make_label("xfailures")
        ),
        "xpasses": func.sum(summary_ref["xpasses"].cast(cast_type)).label(make_label("xpasses")),
        "failures": func.sum(summary_ref["failures"].cast(cast_type)).label(make_label("failures")),
        "errors": func.sum(summary_ref["errors"].cast(cast_type)).label(make_label("errors")),
        "skips": func.sum(summary_ref["skips"].cast(cast_type)).label(make_label("skips")),
        "tests": func.sum(summary_ref["tests"].cast(cast_type)).label(make_label("tests")),
        "min_start_time": func.min(time_ref).label(make_label("min_start_time")),
        "max_start_time": func.max(time_ref).label(make_label("max_start_time")),
        "total_execution_time": func.sum(duration_ref).label(make_label("total_execution_time")),
        "max_duration": func.max(duration_ref).label(make_label("max_duration")),
    }


def create_jenkins_columns(data_source):
    """Helper function to get common Jenkins column references

    :param data_source: The table or subquery to reference (Run table or subquery)
    :return: Dictionary of common column references
    """
    from ibutsu_server.filters import string_to_column  # noqa: PLC0415

    return {
        "job_name": string_to_column("metadata.jenkins.job_name", data_source),
        "build_number": string_to_column("metadata.jenkins.build_number", data_source),
        "build_url": string_to_column("metadata.jenkins.build_url", data_source),
        "annotations": string_to_column("metadata.annotations", data_source),
        "env": string_to_column("env", data_source),
    }


def create_basic_summary_columns(data_source, cast_type=Integer, use_alternate_names=False):
    """Create basic summary columns without time/duration fields

    This is useful for simpler aggregations that don't need timing information.

    :param data_source: The table or column reference (Run table or subquery.c)
    :param cast_type: The SQLAlchemy type to cast to (Integer or Float)
    :param use_alternate_names: Use alternate column names
        (xpassed/xfailed instead of xpasses/xfailures)
    :return: Dictionary of basic summary column expressions
    """
    summary_ref = data_source.c.summary if hasattr(data_source, "c") else data_source.summary

    # Handle different naming conventions
    if use_alternate_names:
        xpass_field = "xpassed"
        xfail_field = "xfailed"
        xpass_label = "xpassed"
        xfail_label = "xfailed"
    else:
        xpass_field = "xpasses"
        xfail_field = "xfailures"
        xpass_label = "xpasses"
        xfail_label = "xfailures"

    return {
        xfail_label: func.sum(summary_ref[xfail_field].cast(cast_type)).label(xfail_label),
        xpass_label: func.sum(summary_ref[xpass_field].cast(cast_type)).label(xpass_label),
        "failures": func.sum(summary_ref["failures"].cast(cast_type)).label("failures"),
        "errors": func.sum(summary_ref["errors"].cast(cast_type)).label("errors"),
        "skips": func.sum(summary_ref["skips"].cast(cast_type)).label("skips"),
        "tests": func.sum(summary_ref["tests"].cast(cast_type)).label("tests"),
    }


def create_time_columns(data_source):
    """Create time-related aggregation columns

    :param data_source: The table or column reference (Run table or subquery.c)
    :return: Dictionary of time column expressions
    """
    if hasattr(data_source, "c"):  # It's a subquery
        time_ref = data_source.c.start_time
        duration_ref = data_source.c.duration
    else:  # It's the Run table
        time_ref = data_source.start_time
        duration_ref = data_source.duration

    return {
        "min_start_time": func.min(time_ref).label("min_start_time"),
        "max_start_time": func.max(time_ref).label("max_start_time"),
        "total_execution_time": func.sum(duration_ref).label("total_execution_time"),
        "max_duration": func.max(duration_ref).label("max_duration"),
    }
