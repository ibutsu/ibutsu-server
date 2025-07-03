import json
from datetime import datetime
from http import HTTPStatus

import magic
from flask import make_response, request

from ibutsu_server.db import db
from ibutsu_server.db.models import Artifact, Result, User
from ibutsu_server.util.app_context import with_app_context
from ibutsu_server.util.projects import add_user_filter, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import is_uuid, validate_uuid


@with_app_context
def _build_artifact_response(id_):
    """Build a response for the artifact"""
    artifact = db.session.get(Artifact, id_)
    if not artifact:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    # Create a response with the contents of this file
    response = make_response(artifact.content, HTTPStatus.OK)
    # Set the content type and the file name
    file_type = magic.from_buffer(artifact.content, mime=True)
    response.headers["Content-Type"] = file_type
    return artifact, response


@validate_uuid
def view_artifact(id_, token_info=None, user=None):
    """Stream an artifact directly to the client/browser

    :param id: ID of the artifact to download
    :type id: str

    :rtype: file
    """
    artifact, response = _build_artifact_response(id_)
    if artifact.result and not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    elif artifact.run and not project_has_user(artifact.run.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return response


@validate_uuid
def download_artifact(id_, token_info=None, user=None):
    """Download an artifact

    :param id: ID of artifact to download
    :type id: str

    :rtype: file
    """
    artifact, response = _build_artifact_response(id_)
    if not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    response.headers["Content-Disposition"] = f"attachment; filename={artifact.filename}"
    return response


@validate_uuid
@with_app_context
def get_artifact(id_, token_info=None, user=None):
    """Return a single artifact

    :param id: ID of the artifact
    :type id: str

    :rtype: Artifact
    """
    artifact = db.session.get(Artifact, id_)
    if not artifact:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return artifact.to_dict()


@with_app_context
@with_app_context
def get_artifact_list(
    result_id=None, run_id=None, page_size=25, page=1, token_info=None, user=None
):
    """Get a list of artifact files for result

    :param id: ID of test result
    :type id: str

    :rtype: List[Artifact]
    """
    query = db.select(Artifact)
    user = db.session.get(User, user)
    if "result_id" in request.args:
        result_id = request.args["result_id"]
    if result_id:
        query = query.where(Artifact.result_id == result_id)
    if run_id:
        query = query.where(Artifact.run_id == run_id)
    if user:
        query = add_user_filter(query, user)
    total_items = db.session.execute(
        db.select(db.func.count()).select_from(query.select_from())
    ).scalar()
    offset = get_offset(page, page_size)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    artifacts = db.session.execute(query.limit(page_size).offset(offset)).scalars().all()
    return {
        "artifacts": [artifact.to_dict() for artifact in artifacts],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "totalItems": total_items,
        },
    }


@with_app_context
def upload_artifact(body, token_info=None, user=None):
    """Uploads a artifact artifact

    :param result_id: ID of result to attach artifact to
    :type result_id: str
    :param run_id: ID of run to attach artifact to
    :type run_id: str
    :param filename: filename for storage
    :type filename: string
    :param file: file to upload
    :type file: werkzeug.datastructures.FileStorage
    :param additional_metadata: Additional data to pass to server
    :type additional_metadata: object

    :rtype: tuple
    """
    result_id = body.get("result_id") or body.get("resultId")
    run_id = body.get("run_id") or body.get("runId")
    if result_id and not is_uuid(result_id):
        return f"Result ID {result_id} is not in UUID format", HTTPStatus.BAD_REQUEST
    if run_id and not is_uuid(run_id):
        return f"Run ID {run_id} is not in UUID format", HTTPStatus.BAD_REQUEST
    result = db.session.get(Result, result_id)
    if result and not project_has_user(result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    filename = body.get("filename")
    additional_metadata = body.get("additional_metadata", {})
    file_ = request.files.get("file")
    content_type = body.get("content_type")
    if file_ is not None:
        content_type = magic.from_buffer(file_.read())
    data = {
        "contentType": content_type,
        "resultId": result_id,
        "runId": run_id,
        "filename": filename,
    }
    if additional_metadata:
        if isinstance(additional_metadata, str):
            try:
                additional_metadata = json.loads(additional_metadata)
            except (ValueError, TypeError):
                return "Bad request, additionalMetadata is not valid JSON", HTTPStatus.BAD_REQUEST
        if not isinstance(additional_metadata, dict):
            return "Bad request, additionalMetadata is not a JSON object", HTTPStatus.BAD_REQUEST
        data["additionalMetadata"] = additional_metadata
    # Reset the file pointer
    file_.seek(0)
    if data.get("runId"):
        artifact = Artifact(
            filename=filename,
            run_id=data["runId"],
            content=file_.read(),
            upload_date=datetime.utcnow(),
            data=additional_metadata,
        )
    else:
        artifact = Artifact(
            filename=filename,
            result_id=data["resultId"],
            content=file_.read(),
            upload_date=datetime.utcnow(),
            data=additional_metadata,
        )

    db.session.add(artifact)
    db.session.commit()
    return artifact.to_dict(), HTTPStatus.CREATED


@validate_uuid
@with_app_context
def delete_artifact(id_, token_info=None, user=None):
    """Deletes an artifact

    :param id: ID of the artifact to delete
    :type id: str

    :rtype: tuple
    """
    artifact = db.session.get(Artifact, id_)
    if not artifact:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    db.session.delete(artifact)
    db.session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
