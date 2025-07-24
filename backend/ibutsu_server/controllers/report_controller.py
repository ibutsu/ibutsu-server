from datetime import datetime
from http import HTTPStatus

from flask import make_response, request

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db import db
from ibutsu_server.db.models import Report, ReportFile
from ibutsu_server.tasks.reports import REPORTS
from ibutsu_server.util.app_context import with_app_context
from ibutsu_server.util.projects import get_project_id
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


@with_app_context
def _build_report_response(id_):
    """Get a report and build a Response object

    :rtype: tuple
    """
    report = db.session.get(Report, id_)
    if not report:
        return "Report not found", HTTPStatus.NOT_FOUND
    report_file = db.session.execute(
        db.select(ReportFile).where(ReportFile.report_id == id_)
    ).scalar_one_or_none()
    if not report_file:
        return "File not found", HTTPStatus.NOT_FOUND
    response = make_response(report_file.content, HTTPStatus.OK)
    response.headers["Content-Type"] = report.mimetype
    return report, response


def get_report_types(token_info=None, user=None):
    """Get the types of reports that are available

    :rtype: list
    """
    return [{"type": key, "name": val["name"]} for key, val in REPORTS.items()]


@with_app_context
def add_report(report_parameters=None):
    """Create a new report

    :param report: The report to generate
    :type report: dict | bytes

    :rtype: Report
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    report_parameters = request.json
    if report_parameters["type"] not in REPORTS:
        return "Bad request, report type does not exist", HTTPStatus.BAD_REQUEST

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
    db.session.add(report)
    db.session.commit()
    report_dict.update(report.to_dict())
    REPORTS[report_parameters["type"]]["func"].delay(report_dict)
    return report_dict, HTTPStatus.CREATED


@validate_uuid
@with_app_context
def get_report(id_, token_info=None, user=None):
    """Get a report

    :param id: The ID of the report
    :type id: str

    :rtype: Report
    """
    report = db.session.get(Report, id_)
    return report.to_dict()


@with_app_context
def get_report_list(page=1, page_size=25, project=None, token_info=None, user=None):
    """Get a list of reports

    :param page: Set the page of items to return, defaults to 1
    :type page: int
    :param page_size: Set the number of items per page, defaults to 25
    :type page_size: int

    :rtype: ReportList
    """
    query = db.select(Report)
    if project:
        project_id = get_project_id(project)
        query = query.where(Report.project_id == project_id)
    offset = get_offset(page, page_size)
    total_items = db.session.execute(db.select(db.func.count()).select_from(query)).scalar()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    reports = (
        db.session.execute(query.order_by(Report.created.desc()).offset(offset).limit(page_size))
        .scalars()
        .all()
    )
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
@with_app_context
def delete_report(id_, user=None, token_info=None):
    """Deletes a report

    :param id: ID of the report to delete
    :type id: str

    :rtype: tuple
    """
    report = db.session.get(Report, id_)
    if not report:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND

    report_file = db.session.execute(
        db.select(ReportFile).where(ReportFile.report_id == report.id)
    ).scalar_one_or_none()
    db.session.delete(report_file)

    db.session.delete(report)
    db.session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK


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
    response.headers["Content-Disposition"] = f"attachment; filename={report.filename}"
    return response
