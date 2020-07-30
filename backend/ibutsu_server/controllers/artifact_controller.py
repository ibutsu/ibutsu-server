import json

import connexion
import magic
from flask import make_response
from ibutsu_server.db.models import Artifact
from ibutsu_server.db.base import session
from ibutsu_server.util.json import jsonify


def _build_artifact_response(id_):
    """Build a response for the artifact"""
    artifact = Artifact.query.get(id_)
    if not artifact:
        return "Not Found", 404
    # Create a response with the contents of this file
    response = make_response(artifact.content, 200)
    # Set the content type and the file name
    if artifact.get("content_type"):
        file_type = artifact["content_type"]
    elif artifact["metadata"].get("contentType"):
        file_type = artifact["metadata"]["contentType"]
    else:
        file_type = magic.from_buffer(artifact.content, mime=True)
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
    response.headers["Content-Disposition"] = "attachment; filename={}".format(artifact["filename"])
    return response


def get_artifact(id_):
    """Return a single artifact

    :param id: ID of the artifact
    :type id: str

    :rtype: Artifact
    """
    artifact = Artifact.query.get(id_)
    if not artifact:
        return "Not Found", 404
    return artifact.to_dict()


def get_artifact_list(result_id=None, page_size=25, page=1):
    """Get a list of artifact files for result

    :param id: ID of test result
    :type id: str

    :rtype: List[Artifact]
    """
    query = Artifact.query
    if result_id:
        query = query.filter(Artifact.data["metadata"]["resultId"] == jsonify(result_id))
    total_items = query.count()
    offset = (page * page_size) - page_size
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    artifacts = query.limit(page_size).offset(offset).all()
    return {
        "artifacts": [artifact.to_dict() for artifact in artifacts],
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
    data = {"contentType": content_type, "resultId": result_id, "filename": filename}
    if additional_metadata:
        if isinstance(additional_metadata, str):
            try:
                additional_metadata = json.loads(additional_metadata)
            except (ValueError, TypeError):
                return "Bad request, additionalMetadata is not valid JSON", 400
        if not isinstance(additional_metadata, dict):
            return "Bad request, additionalMetadata is not a JSON object", 400
        data["additionalMetadata"] = additional_metadata
    artifact = Artifact(data=data, content=file_.read())
    session.add(artifact)
    session.commit()
    return artifact.to_dict(), 201


def delete_artifact(id_):
    """Deletes an artifact

    :param id: ID of the artifact to delete
    :type id: str

    :rtype: tuple
    """
    artifact = Artifact.query.get(id_)
    if not artifact:
        return "Not Found", 404
    else:
        session.delete(artifact)
        session.commit()
        return "OK", 200
