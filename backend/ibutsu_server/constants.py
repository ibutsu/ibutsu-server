LOCALHOST = "127.0.0.1"

OAUTH_CONFIG = {
    "google": {
        "scope": ["https://www.googleapis.com/auth/userinfo.profile"],
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "user_url": "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
    },
    "github": {
        "scope": ["user"],
        "user_url": "https://api.github.com/user",
        "email_url": "https://api.github.com/user/emails",
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
    },
    "facebook": {
        "scope": ["email", "public_profile"],
        "auth_url": "https://www.facebook.com/v11.0/dialog/oauth",
        "user_url": "",
        "token_url": "https://graph.facebook.com/v11.0/oauth/access_token",
    },
    "gitlab": {
        "scope": ["read_user"],
        "sep": "+",
        "user_url": "/api/v4/user",
        "auth_url": "/oauth/authorize",
        "token_url": "/oauth/token",
    },
}
ALLOWED_TRUE_BOOLEANS = ["y", "t", "1"]
ARRAY_FIELDS = ["metadata.tags", "metadata.markers", "metadata.annotations"]
NUMERIC_FIELDS = [
    "duration",
    "start_time",
    "summary.failures",
    "summary.errors",
    "summary.passes",
    "summary.skips",
    "summary.tests",
    "summary.xfailures",
    "summary.xpasses",
]
MAX_PAGE_SIZE = 500  # max page size API can return, page_sizes over this are sent to a worker
HEATMAP_MAX_BUILDS = 40  # max for number of builds that are possible to display in heatmap
BARCHART_MAX_BUILDS = 150  # max for number of builds possible to display in bar chart
COUNT_TIMEOUT = 0.5  # timeout for counting the number of documents [s]
COUNT_ESTIMATE_LIMIT = 1000  # if count estimate < COUNT_ESTIMATE_LIMIT, actually count
MAX_DOCUMENTS = 100000  # max documents for pagination, when apply_max=True
JJV_RUN_LIMIT = 8000  # max runs from which to aggregate Jenkins Jobs
HEATMAP_RUN_LIMIT = 3000  # max runs from which to determine recent Jenkins builds
SYNC_RUN_TIME = 3 * 60 * 60  # time for searching through aborted runs, 3 hrs in [s]
_ADDITIONAL_FILTERS_PARAM = {
    "name": "additional_filters",
    "description": "Comma-separated list of additional filters, cf. "
    "https://docs.ibutsu-project.org/en/latest/user-guide/filter-help.html ",
    "type": "string",
    "required": False,
}
WIDGET_TYPES = {
    "compare-runs-view": {
        "id": "compare-runs-view",
        "title": "Compare Runs",
        "description": "A summary of multiple ran test results filtered",
        "params": [
            {
                "name": "filters",
                "description": "List of filters used for comparison",
                "type": "list",
                "required": True,
            }
        ],
        "type": "view",
    },
    "jenkins-heatmap": {
        "id": "jenkins-heatmap",
        "title": "Jenkins Pipeline Heatmap",
        "description": "A heatmap of test runs from a Jenkins pipeline",
        "params": [
            {
                "name": "job_name",
                "description": "The Jenkins job name, "
                "this is the value of the 'metadata.jenkins.job_name' key.",
                "type": "string",
                "required": True,
            },
            {
                "name": "builds",
                "description": "The number of Jenkins builds to analyze.",
                "type": "integer",
                "default": 5,
                "required": True,
            },
            {
                "name": "group_field",
                "description": "The field in a result to group by, typically 'component'",
                "type": "string",
                "required": True,
                "default": "component",
            },
            {
                "name": "count_skips",
                "description": "Count skips against the pass rate.",
                "type": "boolean",
                "required": False,
                "default": True,
            },
            _ADDITIONAL_FILTERS_PARAM,
        ],
        "type": "widget",
    },
    "filter-heatmap": {
        "id": "filter-heatmap",
        "title": "Filtered Heatmap",
        "description": "A heatmap of filtered test runs.",
        "params": [
            {
                "name": "filters",
                "description": "The filters for the runs to be included" " in the query.",
                "type": "string",
                "required": True,
            },
            {
                "name": "builds",
                "description": "The number of builds to analyze.",
                "type": "integer",
                "default": 5,
                "required": True,
            },
            {
                "name": "group_field",
                "description": "The field in a result to group by, typically 'component'",
                "type": "string",
                "required": True,
                "default": "component",
            },
        ],
        "type": "widget",
    },
    "run-aggregator": {
        "id": "run-aggregator",
        "title": "Run Aggregation",
        "description": "An aggregation of recent run results",
        "params": [
            {
                "name": "group_field",
                "description": "Run data to order by, e.g. 'component' or 'env'",
                "type": "string",
                "required": True,
                "default": "component",
            },
            {
                "name": "weeks",
                "description": "Aggregate test results from <weeks> weeks ago, e.g. 4",
                "type": "integer",
                "required": True,
                "default": 4,
            },
            {
                "name": "chart_type",
                "description": "Type of chart with which to display results, e.g. 'bar' or 'line'",
                "type": "string",
                "required": False,
                "default": "bar",
            },
            _ADDITIONAL_FILTERS_PARAM,
        ],
        "type": "widget",
    },
    "result-summary": {
        "id": "result-summary",
        "title": "Result Summary",
        "description": "A summary of the saved test results, optionally filtered",
        "params": [
            {
                "name": "source",
                "description": "Filter test results by a specific 'source'",
                "type": "string",
                "required": False,
            },
            {
                "name": "env",
                "description": "Filter test results by a specific 'env'",
                "type": "string",
                "required": False,
            },
            {
                "name": "job_name",
                "description": "Filter test results by a specific jenkins job",
                "type": "string",
                "required": False,
            },
            _ADDITIONAL_FILTERS_PARAM,
        ],
        "type": "widget",
    },
    "result-aggregator": {
        "id": "result-aggregator",
        "title": "Result Aggregation",
        "description": "A count of test results that fall into various categories",
        "params": [
            {
                "name": "group_field",
                "description": "Result data to group by, e.g. 'env', "
                "'metadata.assignee', 'metadata.exception_name'",
                "type": "string",
                "required": True,
                "default": "result",
            },
            {
                "name": "days",
                "description": "Aggregate test results from <days> days ago, e.g. 3",
                "type": "float",
                "required": False,
                "default": 3,
            },
            {
                "name": "run_id",
                "description": "Aggregate results from a specific run",
                "type": "string",
                "required": False,
            },
            {
                "name": "chart_type",
                "description": "Type of chart with which to display results, e.g. 'pie' or 'bar'",
                "type": "string",
                "required": False,
                "default": "pie",
            },
            _ADDITIONAL_FILTERS_PARAM,
        ],
        "type": "widget",
    },
    "importance-component": {
        "id": "importance-component",
        "title": "Importance by component",
        "description": "Test results filtered by component and broken down by importance",
        "params": [
            {
                "name": "job_name",
                "description": "The name of the jenkins job to pull from",
                "type": "string",
                "required": True,
                "default": "",
            },
            {
                "name": "group_field",
                "description": "the field in a result to group by, typically 'component'",
                "type": "string",
                "required": True,
                "default": "component",
            },
            {
                "name": "env",
                "description": "The environment to filter by",
                "type": "string",
                "required": False,
                "default": "",
            },
            {
                "name": "components",
                "description": "The component(s) to filter by",
                "type": "string",
                "required": True,
                "default": "",
            },
            {
                "name": "builds",
                "description": "The number of Jenkins builds to analyze.",
                "type": "integer",
                "default": 5,
                "required": False,
            },
        ],
        "type": "widget",
    },
    "accessibility-dashboard-view": {
        "id": "accessibility-dashboard-view",
        "title": "Accessibility Dashboard View",
        "params": [],
        "type": "view",
    },
    "accessibility-analysis-view": {
        "id": "accessibility-analysis-view",
        "title": "Accessibility Analysis View",
        "params": [
            {
                "name": "run_list",
                "description": "List of run IDs for the analysis to pull in",
                "type": "list",
            },
        ],
        "type": "view",
    },
    "accessibility-bar-chart": {
        "id": "accessibility-bar-chart",
        "title": "Accessibility Bar Chart",
        "description": "A bar chart to display aggregate test results ",
        "params": [
            {
                "name": "run_list",
                "description": "A list of run IDs",
                "type": "list",
                "required": True,
            }
        ],
        "type": "widget",
    },
    "jenkins-job-view": {
        "id": "jenkins-job-view",
        "title": "Jenkins Job View",
        "params": [
            {"name": "filter", "description": "Filters for the Jenkins Jobs", "type": "list"},
            {"name": "page", "description": "Desired page of builds to return.", "type": "integer"},
            {
                "name": "page_size",
                "description": "Number of builds on each page",
                "type": "integer",
            },
            {
                "name": "run_limit",
                "description": "Limit on runs from which to aggregate jenkins jobs",
                "type": "integer",
            },
        ],
        "type": "view",
    },
    "jenkins-analysis-view": {
        "id": "jenkins-analysis-view",
        "title": "Jenkins Job Analysis",
        "params": [
            {"name": "job_name", "description": "The name of the Jenkins Job", "type": "string"},
            {"name": "builds", "description": "The number of builds to fetch", "type": "integer"},
        ],
        "type": "view",
    },
    "jenkins-bar-chart": {
        "id": "jenkins-bar-chart",
        "title": "Jenkins Bar Chart",
        "description": "A bar chart to display aggregate test results "
        "for a particular jenkins job over time",
        "params": [
            {
                "name": "job_name",
                "description": "The name of the Jenkins Job",
                "type": "string",
                "required": True,
            },
            {
                "name": "builds",
                "description": "The number of builds to fetch",
                "type": "integer",
                "required": True,
                "default": 30,
            },
        ],
        "type": "widget",
    },
    "jenkins-line-chart": {
        "id": "jenkins-line-chart",
        "title": "Jenkins Line Chart",
        "description": "A line chart to display Jenkins job run time for a particular jenkins job",
        "params": [
            {
                "name": "job_name",
                "description": "The name of the Jenkins Job",
                "type": "string",
                "required": True,
            },
            {
                "name": "builds",
                "description": "The number of builds to fetch",
                "type": "integer",
                "required": False,
                "default": 30,
            },
        ],
        "type": "widget",
    },
}
