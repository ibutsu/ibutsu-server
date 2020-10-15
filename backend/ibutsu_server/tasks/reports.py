import json
from collections import defaultdict
from copy import deepcopy
from csv import DictWriter
from datetime import datetime
from io import StringIO

from flask import current_app
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Report
from ibutsu_server.db.models import ReportFile
from ibutsu_server.db.models import Result
from ibutsu_server.filters import convert_filter
from ibutsu_server.tasks import task
from ibutsu_server.templating import render_template
from ibutsu_server.util.projects import get_project_id
from sqlalchemy.exc import OperationalError


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

REPORT_COUNT_TIMEOUT = 2.0  # timeout for counting documents in report
REPORT_MAX_DOCUMENTS = 100000  # max documents for reports


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
    report_type = report["params"]["type"]
    report["name"] = _generate_report_name(report["params"])
    report_filename = "{}.{}".format(report["name"], REPORTS[report_type]["extension"])
    report.update(
        {
            "filename": report_filename,
            "mimetype": REPORTS[report_type]["mimetype"],
            "url": "{}/api/report/{}/download/{}".format(
                current_app.config.get("BACKEND_URL", "http://localhost:8080"),
                report["id"],
                report_filename,
            ),
            "download_url": "{}/api/report/{}/download/{}".format(
                current_app.config.get("BACKEND_URL", "http://localhost:8080"),
                report["id"],
                report_filename,
            ),
            "view_url": "{}/api/report/{}/view/{}".format(
                current_app.config.get("BACKEND_URL", "http://localhost:8080"),
                report["id"],
                report_filename,
            ),
            "status": "running",
        }
    )
    report_record = Report.query.get(report["id"])
    report_record.update(report)
    session.add(report_record)
    session.commit()


def _set_report_status(report_id, status):
    """Set a report's status"""
    report = Report.query.get(report_id)
    report.status = status
    session.add(report)
    session.commit()


def _set_report_done(report):
    """Set a report's status to "done" and write it to the database"""
    _set_report_status(report["id"], "done")


def _set_report_empty(report):
    """
    Set a report's status to "empty" and write it to the database. This could happen if e.g. filters
    are incorrect.
    """
    _set_report_status(report["id"], "empty")


def _build_query(report):
    """Build the filters from a report object"""
    query = Result.query
    if report["params"].get("filter"):
        for report_filter in report["params"]["filter"].split(","):
            if report_filter:
                filter_clause = convert_filter(Result, report_filter.strip())
                if filter_clause is not None:
                    query = query.filter(filter_clause)
    if report["params"]["source"]:
        query = query.filter(Result.source == report["params"]["source"])
    if report["params"].get("project"):
        query = query.filter(Result.project_id == get_project_id(report["params"]["project"]))
    return query


def _get_results(report):
    """ Limit the number of documents to REPORT_MAX_DOCUMENTS so as not to crash the server."""
    query = _build_query(report)
    try:
        session.execute(f"SET statement_timeout TO {int(REPORT_COUNT_TIMEOUT * 1000)}; commit;")
        if query.count() == 0:
            return None
    except OperationalError:
        pass
    session.execute("SET statement_timeout TO 0; commit;")

    results = query.order_by(Result.start_time.desc()).limit(REPORT_MAX_DOCUMENTS).all()

    return [result.to_dict() for result in results]


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
    """Fetch any reports"""
    return [
        {
            "filename": report_file.filename,
            "url": "{}/api/artifact/{}/download".format(
                current_app.config.get("BACKEND_URL", "http://localhost:8080"), str(report_file.id)
            ),
        }
        for report_file in ReportFile.query.filter(
            ReportFile.data["resultId"] == result["id"]
        ).all()
    ]


def _make_dict(results):
    """Make a dictionary for the JSON and HTML reports"""
    report_dict = {}
    for result in results:
        result_path = _make_result_path(result)
        if result.get("duration") and result.get("start_time"):
            try:
                finish_time = float(result["start_time"].timestamp()) + float(result["duration"])
            except ValueError:
                finish_time = None
        else:
            finish_time = None
        result_id = result.get("id") or str(result["_id"])
        report_dict[result_id] = {
            "files": _get_files(result),
            "exception": _get_value(result, "metadata", "short_tb"),
            "exception_name": _exception_metadata_hack(result),
            "run": _get_value(result, "run_id"),
            "qa_contact": _get_value(result, "metadata", "qa_contact"),
            "stream": _get_value(result, "metadata", "stream"),
            "finish_time": finish_time,
            "start_time": _get_value(result, "start_time"),
            "source": result["source"],
            "duration": result.get("duration", 0),
            "params": _get_value(result, "params"),
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
        row = _make_row(result)
        field_names |= set(row.keys())
    # Now rewind the cursor and write the results to the CSV
    csv_file = StringIO()
    csv_writer = DictWriter(csv_file, fieldnames=list(field_names), extrasaction="ignore")
    csv_writer.writeheader()
    for result in results:
        csv_writer.writerow(_make_row(result))
    # Write the report to the database
    csv_file.seek(0)
    report_file = ReportFile(
        filename=report["filename"],
        data={"contentType": "application/csv"},
        report_id=report["id"],
        content=csv_file.read().encode("utf8"),
    )
    session.add(report_file)
    session.commit()
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
    text_file.write("Filter: {}\n".format(report["params"].get("filter", "")))
    text_file.write("Source: {}\n".format(report["params"]["source"]))
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
    for result in results:
        result_path = _make_result_path(result)
        text_file.write("{}: {}\n".format(result_path, result["result"]))
    # Write the report to the database
    text_file.seek(0)
    report_file = ReportFile(
        filename=report["filename"],
        data={"contentType": "text/plain"},
        report_id=report["id"],
        content=text_file.read().encode("utf8"),
    )
    session.add(report_file)
    session.commit()
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
    # Write the report to the database
    report_file = ReportFile(
        filename=report["filename"],
        data={"contentType": "application/json"},
        report_id=report["id"],
        content=json.dumps(report_dict, indent=2).encode("utf8"),
    )
    session.add(report_file)
    session.commit()
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
    # Write the report to the database
    report_file = ReportFile(
        filename=report["filename"],
        data={"contentType": "text/hmtl"},
        report_id=report["id"],
        content=html_report.encode("utf8"),
    )
    session.add(report_file)
    session.commit()
    _set_report_done(report)


@task
def generate_exception_report(report):
    """Generate a text report"""
    _update_report(report)
    # TODO speed up with filtering
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
    # Write the report to the database
    report_file = ReportFile(
        filename=report["filename"],
        data={"contentType": "text/html"},
        report_id=report["id"],
        content=exception_report.encode("utf8"),
    )
    session.add(report_file)
    session.commit()
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
