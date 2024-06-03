from http import HTTPStatus

import connexion

from ibutsu_server.constants import ALLOWED_TRUE_BOOLEANS, WIDGET_TYPES
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


def _pre_process_params(params):
    """Reduce congnitive complexity"""
    new_params = params.copy()
    for param in params.keys():
        # Some parameters are Python reserved words
        if param in RESERVED_PARAMS:
            new_params.pop(param)
            new_params[RESERVED_PARAMS.get(param)] = params[param]
    params = new_params.copy()
    return params


def _typecast_params(widget_id, params):
    """Reduce congnitive complexity"""
    param_types = {p["name"]: p["type"] for p in WIDGET_TYPES[widget_id]["params"]}
    for param in params.keys():
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
    if id_ not in WIDGET_TYPES.keys():
        return "Widget not found", HTTPStatus.NOT_FOUND
    params = {}
    for key in connexion.request.args.keys():
        params[key] = connexion.request.args.getlist(key)
    params = _pre_process_params(params)
    params = _typecast_params(id_, params)
    return WIDGET_METHODS[id_](**params)
