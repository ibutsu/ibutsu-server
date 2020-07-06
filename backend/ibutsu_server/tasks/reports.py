import json
from collections import defaultdict
from copy import deepcopy
from csv import DictWriter
from datetime import datetime
from io import StringIO

from bson import ObjectId
from dynaconf import settings
from ibutsu_server.filters import generate_filter_object
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import task
from ibutsu_server.templating import render_template
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id

TREE_ROOT = {
    "items": {},
    "stats": {"passed": 0, "failed": 0, "skipped": 0, "error": 0, "xpassed": 0, "xfailed": 0},
    "duration": 0.0,
}

BSTRAP_INFO = "bg-info"
BSTRAP_WARN = "bg-warning"
BSTRAP_DANGER = "bg-danger"

FAILURE_PERC_WARN = 0.2  # % of tests failing to be warning level
FAILURE_PERC_DANGER = 0.4


def _generate_report_name(report_parameters):
    """Generate a report name from the parameters and the date and time

    :param report_parameters: The parameters for this report
    :type report_parameters: dict

    :rtype str:
    """
    return "report-{}-{}-{}".format(
        report_parameters["type"],
        report_parameters["source"],
        datetime.utcnow().strftime("%Y%m%d%H%M%s"),
    )


def _get_value(d, *keys):
    for key in keys:
        if not d.get(key):
            return None
        d = d[key]
    return d


def _update_report(report):
    """Update the report with the parameters, etc."""
    report_type = report["parameters"]["type"]
    report["name"] = _generate_report_name(report["parameters"])
    report_filename = "{}.{}".format(report["name"], REPORTS[report_type]["extension"])
    report.update(
        {
            "filename": report_filename,
            "mimetype": REPORTS[report_type]["mimetype"],
            "url": "{}/api/report/{}/download/{}".format(
                settings.get("BACKEND_URL", "http://localhost:8080"), report["id"], report_filename
            ),
            "download_url": "{}/api/report/{}/download/{}".format(
                settings.get("BACKEND_URL", "http://localhost:8080"), report["id"], report_filename
            ),
            "view_url": "{}/api/report/{}/view/{}".format(
                settings.get("BACKEND_URL", "http://localhost:8080"), report["id"], report_filename
            ),
            "status": "running",
        }
    )
    mongo.reports.replace_one({"_id": ObjectId(report["id"])}, report)


def _set_report_done(report):
    """Set a report's status to "done" and write it to Mongo"""
    report["status"] = "done"
    mongo.reports.replace_one({"_id": ObjectId(report["id"])}, report)


def _set_report_empty(report):
    """
    Set a report's status to "empty" and write it to Mongo. This could happen if e.g. filters
    are incorrect.
    """
    report["status"] = "empty"
    mongo.reports.replace_one({"_id": ObjectId(report["id"])}, report)


def _build_filters(report):
    """Build the filters from a report object"""
    filters = {}
    if report["parameters"].get("filter"):
        for f in report["parameters"]["filter"].split(","):
            filters.update(generate_filter_object(f.strip()))
    if report["parameters"]["source"]:
        filters["source"] = {"$eq": report["parameters"]["source"]}
    if report["parameters"].get("project"):
        filters["metadata.project"] = get_project_id(report["parameters"]["project"])
    return filters


def _get_results(report):
    filters = _build_filters(report)
    if mongo.results.count_documents(filters) == 0:
        return None
    else:
        return mongo.results.find(filters)


def _make_result_path(result):
    """Create a path for the result, using the fspath and test id"""
    result_path = ""
    if result.get("metadata") and result["metadata"].get("fspath"):
        fspath = result["metadata"]["fspath"]
        if fspath.startswith("../"):
            fspath = fspath[3:]
        if fspath.startswith("./"):
            fspath = fspath[2:]
        result_path = "{}::".format(fspath)
    result_path += result["test_id"]
    return result_path


def _make_row(old, parent_key=None):
    """Make nested dictionary into a single-level dictionary, with additional processing for lists

    For example:

    {
        "metadata": {
            "durations": {
                "call": 38.6015,
                "setup": 0.0021
            },
            "statuses": {
                "call": ["failed", False],
                "setup": ["passed", False]
            }
        },
        "result": "failed",
        "test_id": "test_navigation"
    }

    becomes:

    {
        "metadata.durations.call": 38.6015,
        "metadata.durations.setup": 0.0021,
        "metadata.statuses.call": "\"failed\",False",
        "metadata.statuses.setup": "\"passed\",False",
        "result": "failed",
        "test_id": "test_navigation"
    }

    :param old: The old dictionary to flatten
    :type old: dict
    :param parent_key: The key of the parent object
    :type parent_key: str | None

    :rtype: dict
    """
    new = {}
    for key, value in old.items():
        new_key = "{}.{}".format(parent_key, str(key)) if parent_key else str(key)
        if isinstance(value, dict):
            new.update(_make_row(value, new_key))
        elif isinstance(value, list):
            new[new_key] = ",".join([str(v) for v in value])
        else:
            new[new_key] = value
    return new


def _get_files(result):
    """Fetch any artifacts"""
    return [
        {
            "filename": a.filename,
            "url": "{}/api/artifact/{}/download".format(
                settings.get("BACKEND_URL", "http://localhost:8080"), str(a._id)
            ),
        }
        for a in mongo.fs.find({"metadata.resultId": str(result["_id"])})
    ]


def _make_dict(results):
    """Make a dictionary for the JSON and HTML reports"""
    report_dict = {}
    for result in results:
        result_path = _make_result_path(result)
        if result.get("duration"):
            finish_time = result["start_time"] + result["duration"]
        else:
            # finish_time = result["start time"]
            finish_time = None
        result_id = result.get("id") or str(result["_id"])
        report_dict[result_id] = {
            "files": _get_files(result),
            "exception": _get_value(result, "metadata", "short_tb"),
            "exception_name": _exception_metadata_hack(result),
            "run": _get_value(result, "metadata", "run"),
            "qa_contact": _get_value(result, "metadata", "qa_contact"),
            "stream": _get_value(result, "metadata", "stream"),
            "finish_time": finish_time,
            "start_time": result["start_time"],
            "source": result["source"],
            "duration": result.get("duration", 0),
            "params": _get_value(result, "parameters"),
            "build": _get_value(result, "metadata", "build"),
            "jenkins": _get_value(result, "metadata", "jenkins"),
            "_id": result_id,
            "name": result_path,
            "statuses": {
                "overall": result["result"],
                "setup": _get_value(result, "metadata", "statuses", "setup"),
                "call": _get_value(result, "metadata", "statuses", "call"),
                "teardown": _get_value(result, "metadata", "statuses", "teardown"),
            },
        }
    return report_dict


def _build_tree(path, tree, result):
    """Build a tree structure for the HTML report

    Returns: None

    Notes:
        Modifies tree, adding result meta
        Recurses when path is not a individual test node
    """
    if isinstance(path, str):
        path = path.split("::")[0].split("/") + [path.split("::")[-1]]
    root = path[0]
    remainder = path[1:]

    if not remainder:
        # If we are at the end node, ie a test.
        tree["items"][root] = result
        try:
            tree["stats"][result["statuses"]["overall"]] += 1
        except Exception:
            tree["stats"]["failed"] += 1
        duration = result.get("duration", 0.0)
        if duration:
            tree["duration"] += float(duration)
    else:
        # Otherwise we are in a module
        if root not in tree["items"]:
            tree["items"][root] = deepcopy(TREE_ROOT)
        # Call again to recurse down the tree.
        _build_tree(remainder, tree["items"][root], result)
        try:
            tree["stats"][result["statuses"]["overall"]] += 1
        except Exception:
            tree["stats"]["failed"] += 1
        duration = result.get("duration", 0.0)
        if duration:
            tree["duration"] += float(duration)
        # Calculate the number of tests
        total = 0
        for key, val in tree["stats"].items():
            if key in ["passed", "failed", "skipped", "error", "xfailed", "xpassed"]:
                total += val
        # If there were any NON skipped tests, we now calculate the percentage which
        # passed.
        if total:
            tree["stats"]["total"] = total
            tree["stats"]["percentage"] = (
                (tree["stats"]["passed"] + tree["stats"]["xfailed"]) / total * 100
            )
            if tree["stats"]["percentage"] == 100.0:
                tree["stats"]["result"] = "passed"
            elif tree["stats"]["percentage"] > 80.0:
                tree["stats"]["result"] = "failed"
            else:
                tree["stats"]["result"] = "error"


def _exception_metadata_hack(result):
    """the result doesn't have exception_name, before ibutsu_pytest_plugin 1.0.18
    try to scrape it from the short tb

    This hack should be removed when test results in the result DB have the relevant metadata
    """
    exception_name = _get_value(result, "metadata", "exception_name")

    if exception_name is None:
        try:
            exception_name = result["metadata"].get("short_tb", "").split("\n")[-2]
        except Exception:
            exception_name = None
    return exception_name


@task
def generate_csv_report(report):
    """Generate a CSV report"""
    _update_report(report)
    results = _get_results(report)
    if not results:
        _set_report_empty(report)
        return
    # First, loop through ALL the results and collect the names of the columns
    field_names = set()
    for result in results:
        row = _make_row(serialize(result))
        field_names |= set(row.keys())
    # Now rewind the cursor and write the results to the CSV
    csv_file = StringIO()
    csv_writer = DictWriter(csv_file, fieldnames=list(field_names), extrasaction="ignore")
    csv_writer.writeheader()
    results.rewind()
    for result in results:
        csv_writer.writerow(_make_row(serialize(result)))
    # Write the report to MongoDB GridFS
    csv_file.seek(0)
    mongo.report_files.upload_from_stream(
        report["filename"],
        csv_file.read().encode("utf8"),
        metadata={"contentType": "application/csv", "reportId": report["id"]},
    )
    _set_report_done(report)


@task
def generate_text_report(report):
    """Generate a text report"""
    _update_report(report)
    results = _get_results(report)
    if not results:
        _set_report_empty(report)
        return
    # Create file with header
    text_file = StringIO()
    text_file.write("Test Report\n")
    text_file.write("\n")
    text_file.write("Filter: {}\n".format(report["parameters"].get("filter", "")))
    text_file.write("Source: {}\n".format(report["parameters"]["source"]))
    text_file.write("\n")
    # Now loop through the results and summarise them
    summary = {
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "error": 0,
        "xpassed": 0,
        "xfailed": 0,
        "other": 0,
    }
    for result in results:
        if result["result"] in summary:
            summary[result["result"]] += 1
        else:
            summary["other"] += 1
    text_file.writelines(["{}: {}\n".format(key, value) for key, value in summary.items()])
    text_file.write("\n")
    # Rewind the results and write them to the file
    results.rewind()
    for result in results:
        result_path = _make_result_path(result)
        text_file.write("{}: {}\n".format(result_path, result["result"]))
    # Write the report to MongoDB GridFS
    text_file.seek(0)
    mongo.report_files.upload_from_stream(
        report["filename"],
        text_file.read().encode("utf8"),
        metadata={"contentType": "text/plain", "reportId": report["id"]},
    )
    _set_report_done(report)


@task
def generate_json_report(report):
    """Generate a JSON report"""
    _update_report(report)
    results = _get_results(report)
    if not results:
        _set_report_empty(report)
        return
    report_dict = _make_dict(results)
    # Write the report to MongoDB GridFS
    mongo.report_files.upload_from_stream(
        report["filename"],
        json.dumps(report_dict, indent=2).encode("utf8"),
        metadata={"contentType": "application/json", "reportId": report["id"]},
    )
    _set_report_done(report)


@task
def generate_html_report(report):
    """Generate an HTML report"""
    _update_report(report)
    results = _get_results(report)
    if not results:
        _set_report_empty(report)
        return
    report_dict = _make_dict(results)
    tree = deepcopy(TREE_ROOT)
    counts = {
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "error": 0,
        "xpassed": 0,
        "xfailed": 0,
        "other": 0,
    }
    for _, result in report_dict.items():
        _build_tree(result["name"], tree, result)
        try:
            counts[result["statuses"]["overall"]] += 1
        except Exception:
            counts["other"] += 1
    html_report = render_template(
        "reports/html-report.html",
        report_name=report["name"],
        tree=tree,
        results=report_dict,
        report=report,
        counts=counts,
        current_counts=counts,
    )
    # Write the report to MongoDB GridFS
    mongo.report_files.upload_from_stream(
        report["filename"],
        html_report.encode("utf8"),
        metadata={"contentType": "text/html", "reportId": report["id"]},
    )
    _set_report_done(report)


@task
def generate_exception_report(report):
    """Generate a text report"""
    _update_report(report)
    # TODO speed up with mongo filtering
    # join with original filter in deepcopied report
    results = _get_results(report)
    if not results:
        _set_report_empty(report)
        return

    exception_results = [
        result
        for result in results
        if result["result"] in ["error", "failed"] and "short_tb" in result["metadata"]
    ]
    total_count = len(exception_results)

    exception_type_indexed = defaultdict(list)
    for result in exception_results:
        exception_name = _exception_metadata_hack(result)
        if exception_name is None:
            continue
        exception_type_indexed[exception_name].append(result)

    # list of tuples for easy unpacking in the jinja template
    # exception_type, count, color designation
    warn_count = int(round(FAILURE_PERC_WARN * total_count))
    danger_count = int(round(FAILURE_PERC_DANGER * total_count))
    exception_counts = []
    for exception_type, exceptions in exception_type_indexed.items():
        severity_level = BSTRAP_INFO
        if len(exceptions) >= danger_count:
            severity_level = BSTRAP_DANGER
        elif len(exceptions) >= warn_count:
            severity_level = BSTRAP_WARN
        exception_counts.append((exception_type, len(exceptions), severity_level))

    report_dict = _make_dict(exception_results)
    tree = deepcopy(TREE_ROOT)
    counts = defaultdict(int)
    for result in report_dict.values():
        # build tree for each result
        _build_tree(result["name"], tree, result)
        try:
            counts[result["statuses"]["overall"]] += 1
        except Exception:
            counts["other"] += 1

    exception_report = render_template(
        "reports/exception-report.html",
        report_name=report["name"],
        tree=tree,
        results=report_dict,
        report=report,
        exceptions=exception_type_indexed,
        exception_counts=exception_counts,
        counts=counts,
        current_counts=counts,
    )
    # Write the report to MongoDB GridFS
    mongo.report_files.upload_from_stream(
        report["filename"],
        exception_report.encode("utf8"),
        metadata={"contentType": "text/html", "reportId": report["id"]},
    )

    _set_report_done(report)


REPORTS = {
    "csv": {
        "name": "CSV",
        "func": generate_csv_report,
        "mimetype": "application/csv",
        "extension": "csv",
    },
    "text": {
        "name": "Text",
        "func": generate_text_report,
        "mimetype": "text/plain",
        "extension": "txt",
    },
    "json": {
        "name": "JSON",
        "func": generate_json_report,
        "mimetype": "application/json",
        "extension": "json",
    },
    "html": {
        "name": "HTML",
        "func": generate_html_report,
        "mimetype": "text/html",
        "extension": "html",
    },
    "exception": {
        "name": "Exception",
        "func": generate_exception_report,
        "mimetype": "text/html",
        "extension": "html",
    },
}
