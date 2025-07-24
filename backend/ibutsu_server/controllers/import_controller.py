import json
from http import HTTPStatus
from typing import Optional

from flask import request
from werkzeug.datastructures import FileStorage

from ibutsu_server.db import db
from ibutsu_server.db.models import Import, ImportFile
from ibutsu_server.tasks.importers import run_archive_import, run_junit_import
from ibutsu_server.util.app_context import with_app_context
from ibutsu_server.util.projects import get_project, project_has_user
from ibutsu_server.util.uuid import validate_uuid


@validate_uuid
@with_app_context
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


@with_app_context
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
        }
    )
    db.session.add(new_import)
    db.session.commit()
    new_file = ImportFile(import_id=new_import.id, content=import_file.read())
    db.session.add(new_file)
    db.session.commit()
    if import_file.filename.endswith(".xml"):
        run_junit_import.delay(new_import.to_dict())
    elif import_file.filename.endswith(".tar.gz"):
        run_archive_import.delay(new_import.to_dict())
    else:
        return "Unsupported Media Type", 415
    return new_import.to_dict(), HTTPStatus.ACCEPTED
