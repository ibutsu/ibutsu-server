from datetime import datetime

import connexion
from bson import ObjectId
from flask import make_response
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.reports import REPORTS
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id
from pymongo import DESCENDING
from pymongo.errors import OperationFailure


def _build_report_response(id_):
    """Get a report and build a Response object

    :rtype: tuple
    """
    report = mongo.reports.find_one({"_id": ObjectId(id_)})
    if not report:
        return "Report not found", 404
    report_files = [rf for rf in mongo.report_files.find({"metadata.reportId": id_})]
    if not report_files or not report_files[0]:
        return "File not found", 404
    report_file = report_files[0]
    response = make_response(report_file.read(), 200)
    response.headers["Content-Type"] = report["mimetype"]
    return report, response


def get_report_types():
    """Get the types of reports that are available

    :rtype: list
    """
    return [{"type": key, "name": val["name"]} for key, val in REPORTS.items()]


def add_report(report_parameters=None):
    """Create a new report

    :param report: The report to generate
    :type report: dict | bytes

    :rtype: Report
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    report_parameters = connexion.request.json
    if report_parameters["type"] not in REPORTS:
        return "Bad request, report type does not exist", 400
    if "project" in report_parameters:
        report_parameters["project"] = get_project_id(report_parameters["project"])
    report = {
        "filename": "",
        "mimetype": "",
        "url": "",
        "download_url": "",
        "view_url": "",
        "parameters": report_parameters,
        "created": datetime.utcnow().isoformat(),
    }
    mongo.reports.insert_one(report)
    report = serialize(report)
    REPORTS[report_parameters["type"]]["func"].delay(report)
    return report, 201


def get_report(id_):
    """Get a report

    :param id: The ID of the report
    :type id: str

    :rtype: Report
    """
    report = mongo.reports.find_one({"_id": ObjectId(id_)})
    return serialize(report)


def get_report_list(page=1, page_size=25, project=None):
    """Get a list of reports

    :param page: Set the page of items to return, defaults to 1
    :type page: int
    :param page_size: Set the number of items per page, defaults to 25
    :type page_size: int

    :rtype: ReportList
    """
    params = {}
    if project:
        params["parameters.project"] = get_project_id(project)
    offset = (page * page_size) - page_size
    total_items = mongo.reports.count(params)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    reports = mongo.reports.find(
        params, skip=offset, limit=page_size, sort=[("created", DESCENDING)]
    )
    return {
        "reports": [serialize(report) for report in reports],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def delete_report(id_):
    """Deletes a report

    :param id: ID of the report to delete
    :type id: str

    :rtype: tuple
    """
    try:
        mongo.reports.delete_one(ObjectId(id_))
        return "OK", 200
    except OperationFailure:
        return "Not Found", 404


def view_report(id_, filename):
    """View the report file

    :param id_: The ID of the report to view
    :type id_: str

    :rtype: file
    """
    return _build_report_response(id_)[1]


def download_report(id_, filename):
    """Download the report file

    :param id_: The ID of the report to download
    :type id_: str

    :rtype: file
    """
    report, response = _build_report_response(id_)
    response.headers["Content-Disposition"] = "attachment; filename={}".format(report["filename"])
    return response
