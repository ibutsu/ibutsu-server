import json

import connexion
import magic
from bson import ObjectId
from flask import make_response
from gridfs.errors import NoFile
from ibutsu_server.mongo import mongo


def _build_artifact_response(id_):
    """Build a response for the artifact"""
    artifacts = [a for a in mongo.fs.find({"_id": ObjectId(id_)})]
    if not artifacts or not artifacts[0]:
        return "Not Found", 404
    artifact = artifacts[0]
    # Create a response with the contents of this file
    file_contents = artifact.read()
    response = make_response(file_contents, 200)
    # Set the content type and the file name
    if artifact.content_type:
        file_type = artifact.content_type
    elif artifact.metadata.get("contentType"):
        file_type = artifact.metadata["contentType"]
    else:
        file_type = magic.from_buffer(file_contents, mime=True)
    response.headers["Content-Type"] = file_type
    return artifact, response


def view_artifact(id_):
    """Stream an artifact directly to the client/browser

    :param id: ID of the artifact to download
    :type id: str

    :rtype: file
    """
    return _build_artifact_response(id_)[1]


def download_artifact(id_):
    """Download an artifact

    :param id: ID of artifact to download
    :type id: str

    :rtype: file
    """
    artifact, response = _build_artifact_response(id_)
    response.headers["Content-Disposition"] = "attachment; filename={}".format(artifact.filename)
    return response


def get_artifact(id_):
    """Return a single artifact

    :param id: ID of the artifact
    :type id: str

    :rtype: Artifact
    """
    artifacts = [a for a in mongo.fs.find({"_id": ObjectId(id_)})]
    if not artifacts or not artifacts[0]:
        return "Not Found", 404
    artifact = artifacts[0]
    return {
        "id": str(artifact._id),
        "resultId": artifact.metadata["resultId"],
        "filename": artifact.filename,
        "additionalMetadata": artifact.metadata["additionalMetadata"],
    }


def get_artifact_list(result_id=None, page_size=25, page=1):
    """Get a list of artifact files for result

    :param id: ID of test result
    :type id: str

    :rtype: List[Artifact]
    """
    filters = {}
    if result_id:
        filters["metadata.resultId"] = result_id
    offset = (page * page_size) - page_size
    # There's no "count" method in the GridFS API, so we have to do a full query here
    total_items = len(list(mongo.fs.find(filters)))
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    artifacts = mongo.fs.find(filters, limit=page_size, skip=offset, no_cursor_timeout=True)
    return {
        "artifacts": [
            {
                "id": str(artifact._id),
                "filename": artifact.filename,
                "resultId": artifact.metadata["resultId"],
                "additionalMetadata": artifact.metadata.get("additionalMetadata", None),
            }
            for artifact in artifacts
        ],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "totalItems": total_items,
        },
    }


def upload_artifact(body):
    """Uploads a artifact artifact

    :param result_id: ID of result to attach artifact to
    :type result_id: str
    :param filename: filename for storage
    :type filename: string
    :param file: file to upload
    :type file: werkzeug.datastructures.FileStorage
    :param additional_metadata: Additional data to pass to server
    :type additional_metadata: object

    :rtype: tuple
    """
    result_id = body.get("result_id")
    filename = body.get("filename")
    additional_metadata = body.get("additional_metadata", {})
    file_ = connexion.request.files["file"]
    content_type = magic.from_buffer(file_.read())
    # Reset the file pointer
    file_.seek(0)
    metadata = {"contentType": content_type, "resultId": result_id}
    if additional_metadata:
        if isinstance(additional_metadata, str):
            try:
                additional_metadata = json.loads(additional_metadata)
            except (ValueError, TypeError):
                return "Bad request, additionalMetadata is not valid JSON", 400
        if not isinstance(additional_metadata, dict):
            return "Bad request, additionalMetadata is not a JSON object", 400
        metadata["additionalMetadata"] = additional_metadata
    file_id = mongo.fs.upload_from_stream(filename, file_, metadata=metadata)
    return (
        {
            "id": str(file_id),
            "resultId": result_id,
            "filename": filename,
            "additionalMetadata": additional_metadata,
        },
        201,
    )


def delete_artifact(id_):
    """Deletes an artifact

    :param id: ID of the artifact to delete
    :type id: str

    :rtype: tuple
    """
    try:
        mongo.fs.delete(ObjectId(id_))
        return "OK", 200
    except NoFile:
        return "Not Found", 404
