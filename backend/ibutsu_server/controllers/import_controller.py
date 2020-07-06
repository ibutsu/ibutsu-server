from bson import ObjectId
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.importers import run_archive_import
from ibutsu_server.tasks.importers import run_junit_import
from ibutsu_server.util import serialize


def get_import(id_):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    import_ = mongo.imports.find_one({"_id": ObjectId(id_)})
    return serialize(import_)


def add_import(import_file=None, *args, **kwargs):
    """Imports a JUnit XML file and creates a test run and results from it.

    :param import_file: file to upload
    :type import_file: werkzeug.datastructures.FileStorage

    :rtype: Import
    """
    if not import_file:
        return "Bad request, no file uploaded", 400
    new_import = {"status": "pending", "filename": import_file.filename, "format": "", "run_id": ""}
    mongo.imports.insert_one(new_import)
    new_import = serialize(new_import)
    mongo.import_files.upload_from_stream(
        import_file.filename, import_file.stream, metadata={"importId": new_import["id"]}
    )
    if import_file.filename.endswith(".xml"):
        run_junit_import.delay(new_import)
    elif import_file.filename.endswith(".tar.gz"):
        run_archive_import.delay(new_import)
    else:
        return "Unsupported Media Type", 415
    return new_import, 202
