import logging
from http import HTTPStatus

import connexion

from ibutsu_server.constants import ALLOWED_TRUE_BOOLEANS, WIDGET_TYPES
from ibutsu_server.controllers.widget_config_controller import _validate_widget_params
from ibutsu_server.widgets.accessibility_analysis import (
    get_accessibility_analysis_view,
    get_accessibility_bar_chart,
)
from ibutsu_server.widgets.accessibility_dashboard_view import (
    get_accessibility_dashboard_view,
)
from ibutsu_server.widgets.compare_runs_view import get_comparison_data
from ibutsu_server.widgets.filter_heatmap import get_filter_heatmap
from ibutsu_server.widgets.importance_component import get_importance_component
from ibutsu_server.widgets.jenkins_heatmap import get_jenkins_heatmap
from ibutsu_server.widgets.jenkins_job_analysis import (
    get_jenkins_analysis_data,
    get_jenkins_bar_chart,
    get_jenkins_line_chart,
)
from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view
from ibutsu_server.widgets.result_aggregator import get_recent_result_data
from ibutsu_server.widgets.result_summary import get_result_summary
from ibutsu_server.widgets.run_aggregator import get_recent_run_data

logger = logging.getLogger(__name__)

WIDGET_METHODS = {
    "compare-runs-view": get_comparison_data,
    "accessibility-dashboard-view": get_accessibility_dashboard_view,
    "accessibility-analysis-view": get_accessibility_analysis_view,
    "accessibility-bar-chart": get_accessibility_bar_chart,
    "jenkins-analysis-view": get_jenkins_analysis_data,
    "jenkins-bar-chart": get_jenkins_bar_chart,
    "jenkins-heatmap": get_jenkins_heatmap,
    "filter-heatmap": get_filter_heatmap,
    "importance-component": get_importance_component,
    "jenkins-job-view": get_jenkins_job_view,
    "jenkins-line-chart": get_jenkins_line_chart,
    "run-aggregator": get_recent_run_data,
    "result-summary": get_result_summary,
    "result-aggregator": get_recent_result_data,
}
RESERVED_PARAMS = {"filter": "filter_"}


def _pre_process_params(params, widget_id=None):
    """Reduce congnitive complexity"""
    new_params = params.copy()
    for param in params:
        # Some parameters are Python reserved words
        if param in RESERVED_PARAMS:
            new_params.pop(param)
            new_params[RESERVED_PARAMS.get(param)] = params[param]
    # Special handling for jenkins-job-view widget
    if widget_id == "jenkins-job-view" and "filter_" in new_params:
        new_params["additional_filters"] = new_params.pop("filter_")

    # Handle legacy parameter names for backward compatibility
    if widget_id == "jenkins-heatmap" and "jenkins_job_name" in new_params:
        new_params["job_name"] = new_params.pop("jenkins_job_name")

    # Handle filters -> additional_filters migration for compare-runs-view
    if widget_id == "compare-runs-view" and "filters" in new_params:
        new_params["additional_filters"] = new_params.pop("filters")

    return new_params.copy()


def _typecast_params(widget_id, params):
    """Reduce congnitive complexity"""
    param_types = {p["name"]: p["type"] for p in WIDGET_TYPES[widget_id]["params"]}
    for param in params:
        if isinstance(params[param], list) and param_types.get(param) != "list":
            # This is a horrible hack to try to get around a problem in prod
            # that we can't reproduce locally
            params[param] = params[param][0]
        if param in param_types and param_types[param] == "integer":
            params[param] = int(params[param])
        elif param in param_types and param_types[param] == "boolean":
            params[param] = params[param].lower()[0] in ALLOWED_TRUE_BOOLEANS
        elif param in param_types and param_types[param] == "float":
            params[param] = float(params[param])
        elif (
            param in param_types
            and param_types[param] == "list"
            and not isinstance(params[param], list)
        ):
            params[param] = params[param].split(",")
    return params


def get_widget_types(type_=None):
    """Get the types of widgets that are available

    :rtype: list
    """
    widget_types = WIDGET_TYPES.values()
    if type_:
        widget_types = list(filter(lambda wt: wt["type"] == type_, widget_types))
    page_size = len(widget_types)
    return {
        "types": list(widget_types),
        "pagination": {
            "page": 1,
            "pageSize": page_size,
            "totalItems": page_size,
            "totalPages": 1,
        },
    }


def get_widget(id_):
    """Get dashboard widget data

    :param id: The ID of the widget
    :type id: str

    :rtype: object
    """
    if id_ not in WIDGET_TYPES:
        return "Widget not found", HTTPStatus.NOT_FOUND
    params = {}
    for key in connexion.request.args:
        params[key] = connexion.request.args.getlist(key)
    params = _pre_process_params(params, id_)
    params = _typecast_params(id_, params)

    # Validate against the central schema in WIDGET_TYPES[id_]["params"]
    validated_params = _validate_widget_params(id_, params)

    # Check if any invalid parameters were provided
    invalid_params = set(params.keys()) - set(validated_params.keys())
    if invalid_params:
        return (
            f"Invalid parameters for widget '{id_}': {', '.join(invalid_params)}",
            HTTPStatus.BAD_REQUEST,
        )

    try:
        return WIDGET_METHODS[id_](**validated_params)
    except TypeError as e:
        # Handle any remaining parameter issues
        return f"Parameter error for widget '{id_}': {e!s}", HTTPStatus.BAD_REQUEST
    except Exception as e:
        # Handle any runtime errors in widget processing
        logger.exception(f"Error processing widget '{id_}': {e!s}")
        return f"Error processing widget '{id_}': {e!s}", HTTPStatus.INTERNAL_SERVER_ERROR
