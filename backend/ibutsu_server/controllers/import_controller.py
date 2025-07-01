import json
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Optional

from flask import request
from werkzeug.datastructures import FileStorage

from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Import, ImportFile
from ibutsu_server.filters import convert_filter
from ibutsu_server.tasks.importers import run_archive_import, run_junit_import
from ibutsu_server.util.projects import get_project, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


@validate_uuid
def get_import(id_, token_info=None, user=None):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    import_ = db.session.get(Import, id_)
    if import_ and import_.data.get("project_id"):
        project = get_project(import_.data["project_id"])
        if project and not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    if not import_:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    return import_.to_dict()


def get_import_list(filter_=None, page=1, page_size=25, token_info=None, user=None):
    """Get a list of imports

    :param filter_: A list of filters to apply
    :type filter_: list
    :param page: Set the page of items to return, defaults to 1
    :type page: int
    :param page_size: Set the number of items per page, defaults to 25
    :type page_size: int

    :rtype: ImportList
    """
    query = Import.query
    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Import)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    query = query.order_by(Import.created.desc())
    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    imports = query.offset(offset).limit(page_size).all()
    return {
        "imports": [import_.to_dict() for import_ in imports],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def add_import(
    import_file: Optional[FileStorage] = None,
    project: Optional[str] = None,
    metadata: Optional[str] = None,
    source: Optional[str] = None,
    token_info: Optional[str] = None,
    user: Optional[str] = None,
):
    """Imports a JUnit XML file and creates a test run and results from it.

    :param import_file: file to upload
    :type import_file: werkzeug.datastructures.FileStorage
    :param project: the project to add this test run to
    :type project: str
    :param metadata: extra metadata to add to the run and the results, in a JSON string
    :type metadata: str
    :param source: the source of the test run
    :type source: str

    :rtype: Import
    """
    import_file = request.files.get("importFile")
    if not import_file:
        return "Bad request, no file uploaded", HTTPStatus.BAD_REQUEST
    data = {}
    if request.form.get("project"):
        project = request.form["project"]
    if project:
        project_obj = get_project(project)
        if not project_obj:
            return f"Project {project} doesn't exist", HTTPStatus.BAD_REQUEST
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project_obj.id
    if request.form.get("metadata"):
        metadata = json.loads(request.form.get("metadata"))
    data["metadata"] = metadata
    if request.form.get("source"):
        data["source"] = request.form["source"]
    new_import = Import.from_dict(
        **{
            "status": "pending",
            "filename": import_file.filename,
            "format": "",
            "data": data,
            "created": datetime.now(timezone.utc),
        }
    )
    session.add(new_import)
    session.commit()
    new_file = ImportFile(import_id=new_import.id, content=import_file.read())
    session.add(new_file)
    session.commit()
    if import_file.filename.endswith(".xml"):
        run_junit_import.delay(new_import.to_dict())
    elif import_file.filename.endswith(".tar.gz"):
        run_archive_import.delay(new_import.to_dict())
    else:
        return "Unsupported Media Type", 415
    return new_import.to_dict(), HTTPStatus.ACCEPTED
