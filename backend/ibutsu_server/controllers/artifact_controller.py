import json
from datetime import datetime, timezone
from http import HTTPStatus

import connexion
import magic
from flask import make_response

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact, Result, Run, User
from ibutsu_server.util.projects import add_user_filter, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import is_uuid, validate_uuid

# Maximum file size for uploads (5MB)
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
# Chunk size for streaming reads (1MB)
CHUNK_SIZE = 1024 * 1024


class BadRequestError(Exception):
    """Custom exception for bad request errors with HTTP status codes."""

    def __init__(self, message, status=HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


def _get_form_param(form, *keys):
    """Get a form parameter supporting both camelCase and snake_case naming.

    This utility function checks multiple keys in the form data to support
    backward compatibility with both camelCase (OpenAPI spec) and snake_case
    (Python conventions) field names.

    :param form: The form data object
    :param keys: Variable number of key names to try
    :return: The value of the first matching key, or None if not found
    """
    for key in keys:
        value = form.get(key)
        if value is not None:
            return value
    return None


def _build_artifact_response(id_):
    """Build a response for the artifact"""
    artifact = Artifact.query.get(id_)
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
    if (artifact.result and not project_has_user(artifact.result.project, user)) or (
        artifact.run and not project_has_user(artifact.run.project, user)
    ):
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
def get_artifact(id_, token_info=None, user=None):
    """Return a single artifact

    :param id: ID of the artifact
    :type id: str

    :rtype: Artifact
    """
    artifact = Artifact.query.get(id_)
    if not artifact:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return artifact.to_dict()


def get_artifact_list(
    result_id=None, run_id=None, page_size=25, page=1, token_info=None, user=None
):
    """Get a list of artifact files for result

    :param id: ID of test result
    :type id: str

    :rtype: List[Artifact]
    """
    query = Artifact.query
    User.query.get(user)
    if "result_id" in connexion.request.args:
        result_id = connexion.request.args["result_id"]
    if result_id:
        query = query.filter(Artifact.result_id == result_id)
    if run_id:
        query = query.filter(Artifact.run_id == run_id)
    if user:
        query = add_user_filter(query, user)
    total_items = query.count()
    offset = get_offset(page, page_size)
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


def _validate_artifact_upload_params(file_, result_id, run_id, filename):
    """Validate parameters for artifact upload.

    Raises BadRequestError if validation fails.

    :param file_: The uploaded file
    :param result_id: Result ID (if provided)
    :param run_id: Run ID (if provided)
    :param filename: Filename
    :raises BadRequestError: If any validation check fails
    """
    if not file_:
        raise BadRequestError("Bad request, no file uploaded")
    if not result_id and not run_id:
        raise BadRequestError("Bad request, either resultId or runId must be provided")
    # Enforce mutual exclusivity - artifact should be linked to either a result OR a run, not both
    if result_id and run_id:
        raise BadRequestError("Bad request, cannot provide both resultId and runId")
    if not filename:
        raise BadRequestError("Bad request, filename is required")
    if result_id and not is_uuid(result_id):
        raise BadRequestError(f"Result ID {result_id} is not in UUID format")
    if run_id and not is_uuid(run_id):
        raise BadRequestError(f"Run ID {run_id} is not in UUID format")


def _read_file_with_size_limit(file_storage, max_size):
    """Read file content with size validation to prevent OOM attacks.

    This function reads the file in chunks and validates size without loading
    the entire file into memory first. This prevents malicious users from
    sending extremely large files that could cause out-of-memory errors.

    :param file_storage: werkzeug FileStorage object
    :param max_size: Maximum allowed file size in bytes
    :return: File content as bytes
    :raises BadRequestError: If file exceeds size limit or is empty
    """
    # Try to get size using seek if the stream supports it (most efficient)
    stream = file_storage.stream
    if hasattr(stream, "seek") and hasattr(stream, "tell"):
        try:
            current_pos = stream.tell()
            stream.seek(0, 2)  # Seek to end (SEEK_END)
            file_size = stream.tell()
            stream.seek(current_pos)  # Restore position

            if file_size > max_size:
                raise BadRequestError(
                    f"Bad request, file size exceeds maximum allowed size of "
                    f"{max_size // (1024 * 1024)}MB"
                )
            if file_size == 0:
                raise BadRequestError("Bad request, uploaded file is empty")

            # Now we know it's safe to read the whole file
            return stream.read()
        except OSError:
            # If seek fails, fall back to chunked reading
            pass

    # Fall back to chunked reading with size validation
    # This prevents loading oversized files into memory
    chunks = []
    total_size = 0

    while True:
        chunk = stream.read(CHUNK_SIZE)
        if not chunk:
            break

        total_size += len(chunk)
        if total_size > max_size:
            raise BadRequestError(
                f"Bad request, file size exceeds maximum allowed size of "
                f"{max_size // (1024 * 1024)}MB"
            )
        chunks.append(chunk)

    if total_size == 0:
        raise BadRequestError("Bad request, uploaded file is empty")

    return b"".join(chunks)


def _parse_additional_metadata(raw):
    """Parse additional metadata from string or dict.

    Raises BadRequestError if parsing fails.

    :param raw: Metadata as string or dict
    :return: Parsed metadata dictionary
    :raises BadRequestError: If metadata cannot be parsed
    """
    if not raw:
        return {}

    if isinstance(raw, dict):
        return raw

    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            # Validate that the parsed JSON is a dictionary (JSON object)
            if not isinstance(parsed, dict):
                raise BadRequestError(
                    "Bad request, additionalMetadata must be a JSON object, not a list or primitive"
                )
            return parsed
        except (ValueError, TypeError) as e:
            raise BadRequestError("Bad request, additionalMetadata is not valid JSON") from e

    raise BadRequestError("Bad request, additionalMetadata must be an object or JSON string")


def upload_artifact(body=None, token_info=None, user=None):
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
    req = connexion.request

    try:
        # Extract form parameters - support both camelCase (OpenAPI) and snake_case (legacy)
        # Using _get_form_param for consistent field coercion
        file_ = req.files.get("file")
        result_id = _get_form_param(req.form, "resultId", "result_id")
        run_id = _get_form_param(req.form, "runId", "run_id")
        filename = req.form.get("filename")
        additional_metadata = _get_form_param(req.form, "additionalMetadata", "additional_metadata")

        # Validate parameters early
        _validate_artifact_upload_params(file_, result_id, run_id, filename)

        # Check permissions EARLY - before reading file content
        # Check result permissions if result_id is provided
        if result_id:
            result = Result.query.get(result_id)
            if not result:
                raise BadRequestError(f"Result ID {result_id} not found", HTTPStatus.NOT_FOUND)
            if not project_has_user(result.project, user):
                raise BadRequestError(HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN)

        # Check run permissions if run_id is provided
        if run_id:
            run = Run.query.get(run_id)
            if not run:
                raise BadRequestError(f"Run ID {run_id} not found", HTTPStatus.NOT_FOUND)
            if not project_has_user(run.project, user):
                raise BadRequestError(HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN)

        # Create the artifact with snake_case field names (DB model convention)
        artifact = Artifact(
            filename=filename,
            result_id=result_id,
            run_id=run_id,
            content=_read_file_with_size_limit(file_, MAX_UPLOAD_SIZE),
            upload_date=datetime.now(timezone.utc),
            data=_parse_additional_metadata(additional_metadata),
        )

        session.add(artifact)
        session.commit()
        return artifact.to_dict(), HTTPStatus.CREATED

    except BadRequestError as e:
        return e.message, e.status


@validate_uuid
def delete_artifact(id_, token_info=None, user=None):
    """Deletes an artifact

    :param id: ID of the artifact to delete
    :type id: str

    :rtype: tuple
    """
    artifact = Artifact.query.get(id_)
    if not artifact:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(artifact.result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    session.delete(artifact)
    session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
