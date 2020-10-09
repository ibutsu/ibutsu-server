ALLOWED_TRUE_BOOLEANS = ["y", "t", "1"]
ARRAY_FIELDS = ["metadata.tags", "metadata.markers"]
NUMERIC_FIELDS = [
    "duration",
    "start_time",
    "summary.failures",
    "summary.errors",
    "summary.passes",
    "summary.skips",
]
HEATMAP_MAX_BUILDS = 40  # max for number of builds that are possible to display in heatmap
COUNT_TIMEOUT = 0.5  # timeout for counting the number of documents [s]
MAX_DOCUMENTS = 100000  # max documents for pagination, when apply_max=True
JJV_RUN_LIMIT = 8000  # max runs from which to aggregate Jenkins Jobs
HEATMAP_RUN_LIMIT = 4000  # max runs from which to determine recent Jenkins builds
WIDGET_TYPES = {
    "jenkins-heatmap": {
        "id": "jenkins-heatmap",
        "title": "Jenkins Pipeline Heatmap",
        "description": "A heatmap of test runs from a Jenkins pipeline",
        "params": [
            {"name": "job_name", "description": "The Jenkins job name", "type": "string"},
            {
                "name": "builds",
                "description": "The number of Jenkins builds to analyze",
                "type": "integer",
            },
            {
                "name": "group_field",
                "description": "The field in a result to group by",
                "type": "string",
            },
            {"name": "sort_field", "description": "The field to sort results by", "type": "string"},
            {
                "name": "count_skips",
                "description": "Count skips against the pass rate",
                "type": "boolean",
            },
        ],
    },
    "run-aggregator": {
        "id": "run-aggregator",
        "title": "Run Aggregation",
        "description": "An aggregation of recent run results",
        "params": [
            {
                "name": "group_field",
                "description": "Run metadata to order by, e.g. 'component' or 'env'",
                "type": "string",
            },
            {
                "name": "weeks",
                "description": "The number of weeks back in test results to look",
                "type": "integer",
            },
            {
                "name": "chart_type",
                "description": "Type of chart with which to display results, e.g. 'bar' or 'line'",
                "type": "string",
            },
        ],
    },
    "result-summary": {
        "id": "result-summary",
        "title": "Result Summary",
        "description": "A summary of the saved test results, optionally filtered",
        "params": [
            {
                "name": "source",
                "description": "Filter the results before summarising by the source",
                "type": "string",
            },
            {
                "name": "env",
                "description": "Filter by environment, using the metadata.env field",
                "type": "string",
            },
            {"name": "job_name", "description": "Filter by Jenkins job name", "type": "string"},
        ],
    },
    "result-aggregator": {
        "id": "result-aggregator",
        "title": "Result Aggregation",
        "description": "A count of test results that fall into various categories",
        "params": [
            {
                "name": "group_field",
                "description": "Result metadata or data to count against",
                "type": "string",
            },
            {
                "name": "days",
                "description": "The number of days from which to poll the results",
                "type": "float",
            },
            {
                "name": "chart_type",
                "description": "Type of chart with which to display results, e.g. 'pie' or 'bar'",
                "type": "string",
            },
        ],
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
    },
    "jenkins-analysis-view": {
        "id": "jenkins-analysis-view",
        "title": "Jenkins Job Analysis",
        "params": [
            {"name": "job_name", "description": "The name of the Jenkins Job", "type": "string"},
            {"name": "builds", "description": "The number of builds to fetch", "type": "integer"},
        ],
    },
    "jenkins-bar-chart": {
        "id": "jenkins-bar-chart",
        "title": "Jenkins Bar Chart",
        "params": [
            {"name": "job_name", "description": "The name of the Jenkins Job", "type": "string"},
            {"name": "builds", "description": "The number of builds to fetch", "type": "integer"},
        ],
    },
    "jenkins-line-chart": {
        "id": "jenkins-line-chart",
        "title": "Jenkins Line Chart",
        "params": [
            {"name": "job_name", "description": "The name of the Jenkins Job", "type": "string"},
            {"name": "builds", "description": "The number of builds to fetch", "type": "integer"},
        ],
    },
}
