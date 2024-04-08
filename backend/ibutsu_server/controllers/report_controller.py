from datetime import datetime

import connexion
from flask import make_response
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Report
from ibutsu_server.db.models import ReportFile
from ibutsu_server.tasks.reports import REPORTS
from ibutsu_server.util.projects import get_project_id
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


def _build_report_response(id_):
    """Get a report and build a Response object

    :rtype: tuple
    """
    report = Report.query.get(id_)
    if not report:
        return "Report not found", 404
    report_file = ReportFile.query.filter(ReportFile.report_id == id_).first()
    if not report_file:
        return "File not found", 404
    response = make_response(report_file.content, 200)
    response.headers["Content-Type"] = report.mimetype
    return report, response


def get_report_types(token_info=None, user=None):
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

    report_dict = {
        "filename": "",
        "mimetype": "",
        "name": "",
        "url": "",
        "download_url": "",
        "view_url": "",
        "params": report_parameters,
        "created": datetime.utcnow(),
    }
    if "project" in report_parameters:
        report_dict["project_id"] = get_project_id(report_parameters["project"])

    report = Report.from_dict(**report_dict)
    session.add(report)
    session.commit()
    report_dict.update(report.to_dict())
    REPORTS[report_parameters["type"]]["func"].delay(report_dict)
    return report_dict, 201


@validate_uuid
def get_report(id_, token_info=None, user=None):
    """Get a report

    :param id: The ID of the report
    :type id: str

    :rtype: Report
    """
    report = Report.query.get(id_)
    return report.to_dict()


def get_report_list(page=1, page_size=25, project=None, token_info=None, user=None):
    """Get a list of reports

    :param page: Set the page of items to return, defaults to 1
    :type page: int
    :param page_size: Set the number of items per page, defaults to 25
    :type page_size: int

    :rtype: ReportList
    """
    query = Report.query
    if project:
        project_id = get_project_id(project)
        query = query.filter(Report.project_id == project_id)
    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    reports = query.order_by(Report.created.desc()).offset(offset).limit(page_size).all()
    return {
        "reports": [report.to_dict() for report in reports],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def delete_report(id_, user=None, token_info=None):
    """Deletes a report

    :param id: ID of the report to delete
    :type id: str

    :rtype: tuple
    """
    report = Report.query.get(id_)
    if not report:
        return "Not Found", 404

    report_file = ReportFile.query.filter(ReportFile.report_id == report.id).first()
    session.delete(report_file)

    session.delete(report)
    session.commit()
    return "OK", 200


@validate_uuid
def view_report(id_, filename, token_info=None, user=None):
    """View the report file

    :param id_: The ID of the report to view
    :type id_: str

    :rtype: file
    """
    return _build_report_response(id_)[1]


@validate_uuid
def download_report(id_, filename, token_info=None, user=None):
    """Download the report file

    :param id_: The ID of the report to download
    :type id_: str

    :rtype: file
    """
    report, response = _build_report_response(id_)
    response.headers["Content-Disposition"] = "attachment; filename={}".format(report.filename)
    return response
