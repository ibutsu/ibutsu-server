import json

import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Import
from ibutsu_server.db.models import ImportFile
from ibutsu_server.tasks.importers import run_archive_import
from ibutsu_server.tasks.importers import run_junit_import
from ibutsu_server.util.projects import get_project_id
from ibutsu_server.util.uuid import validate_uuid


@validate_uuid
def get_import(id_):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    import_ = Import.query.get(id_)
    return import_.to_dict()


def add_import(import_file=None, project=None, metadata=None, *args, **kwargs):
    """Imports a JUnit XML file and creates a test run and results from it.

    :param import_file: file to upload
    :type import_file: werkzeug.datastructures.FileStorage

    :rtype: Import
    """
    if not import_file:
        return "Bad request, no file uploaded", 400
    data = {}
    if connexion.request.form.get("project"):
        project = connexion.request.form["project"]
    if project:
        data["project_id"] = get_project_id(project)
    if connexion.request.form.get("metadata"):
        metadata = json.loads(connexion.request.form.get("metadata"))
    data["metadata"] = metadata
    new_import = Import.from_dict(
        **{"status": "pending", "filename": import_file.filename, "format": "", "data": data}
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
    return new_import.to_dict(), 202
