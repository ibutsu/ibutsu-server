import json
import tarfile
from datetime import datetime
from io import BytesIO

from dateutil import parser
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact
from ibutsu_server.db.models import Import
from ibutsu_server.db.models import ImportFile
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.tasks import task
from ibutsu_server.tasks.runs import update_run
from ibutsu_server.util.projects import get_project_id
from ibutsu_server.util.uuid import convert_objectid_to_uuid
from ibutsu_server.util.uuid import is_uuid
from lxml import objectify


def _create_result(tar, run_id, result, artifacts, project_id=None, metadata=None):
    """Create a result with artifacts, used in the archive importer"""
    old_id = None
    result_id = convert_objectid_to_uuid(result.get("id"))
    if is_uuid(result_id):
        result_record = session.query(Result).get(result_id)
    else:
        result_record = None
    if result_record:
        result_record.run_id = run_id
    else:
        old_id = result["id"]
        if "id" in result:
            result.pop("id")
        result["run_id"] = run_id
        if project_id:
            result["project_id"] = project_id
        if metadata:
            result["metadata"] = result.get("metadata", {})
            result["metadata"].update(metadata)
        result["env"] = result.get("metadata", {}).get("env")
        result["component"] = result.get("metadata", {}).get("component")
        result_record = Result.from_dict(**result)
    session.add(result_record)
    session.commit()
    result = result_record.to_dict()
    for artifact in artifacts:
        session.add(
            Artifact(
                filename="traceback.log",
                result_id=result["id"],
                data={"contentType": "text/plain", "resultId": result["id"]},
                content=tar.extractfile(artifact).read(),
            )
        )
    session.commit()
    return old_id


def _update_import_status(import_record, status):
    """Update the status of the import"""
    import_record.status = status
    session.add(import_record)
    session.commit()


def _get_ts_element(tree):
    """To reduce cognitive complexity"""
    if tree.tag == "testsuite":
        return tree
    else:
        return tree.testsuite


def _parse_timestamp(ts):
    """To reduce cognitive complexity"""
    return parser.parse(ts.get("timestamp")) if ts.get("timestamp") else datetime.utcnow()


def _process_result(result_dict, testcase):
    """To reduce cognitive complexity"""
    skip_reason = traceback = None
    if testcase.find("failure"):
        result_dict["result"] = "failed"
        traceback = bytes(str(testcase.failure), "utf8")
    elif testcase.find("error"):
        result_dict["result"] = "error"
        traceback = bytes(str(testcase.error), "utf8")
    elif testcase.find("skipped"):
        result_dict["result"] = "skipped"
        skip_reason = str(testcase.skipped)
    elif testcase.find("xfailure"):
        result_dict["result"] = "xfailed"
    elif testcase.find("xpassed"):
        result_dict["result"] = "xpassed"
    else:
        result_dict["result"] = "passed"
    if skip_reason:
        result_dict["metadata"]["skip_reason"] = skip_reason
    return result_dict, traceback


def _add_artifacts(result, testcase, traceback, session):
    """To reduce cognitive complexity"""
    if traceback:
        session.add(
            Artifact(
                filename="traceback.log",
                result_id=result.id,
                data={"contentType": "text/plain", "resultId": result.id},
                content=traceback,
            )
        )
    if testcase.find("system-out"):
        system_out = bytes(str(testcase["system-out"]), "utf8")
        session.add(
            Artifact(
                filename="system-out.log",
                result_id=result.id,
                data={"contentType": "text/plain", "resultId": result.id},
                content=system_out,
            )
        )
    if testcase.find("system-err"):
        system_err = bytes(str(testcase["system-err"]), "utf8")
        session.add(
            Artifact(
                filename="system-err.log",
                result_id=result.id,
                data={"contentType": "text/plain", "resultId": result.id},
                content=system_err,
            )
        )
    session.commit()


def _populate_created_times(run_dict, start_time):
    """To reduce cognitive complexity"""
    if run_dict.get("start_time") and not run_dict.get("created"):
        run_dict["created"] = run_dict["start_time"]
    elif run_dict.get("created") and not run_dict.get("start_time"):
        run_dict["start_time"] = run_dict["created"]
    elif not run_dict.get("created") and not run_dict.get("start_time"):
        run_dict["created"] = start_time
        run_dict["start_time"] = start_time


def _populate_metadata(run_dict, import_record):
    """To reduce cognitive complexity"""
    if import_record.data.get("project_id"):
        run_dict["project_id"] = import_record.data["project_id"]
    elif run_dict.get("metadata", {}).get("project"):
        run_dict["project_id"] = get_project_id(run_dict["metadata"]["project"])
    if run_dict.get("metadata", {}).get("component"):
        run_dict["component"] = run_dict["metadata"]["component"]
    if run_dict.get("metadata", {}).get("env"):
        run_dict["env"] = run_dict["metadata"]["env"]


def _populate_result_metadata(run_dict, result_dict, import_record, has_metadata):
    """To reduce cognitive complexity"""
    # Extend the result metadata with import metadata, and add env and component
    if has_metadata:
        result_dict["metadata"].update(run_dict["metadata"])
        result_dict["env"] = run_dict.get("env")
        result_dict["component"] = run_dict.get("component")
    if import_record.data.get("project_id"):
        result_dict["project_id"] = import_record.data["project_id"]


def _get_test_name_path(testcase):
    """To reduce cognitive complexity"""
    test_name = ""
    backup_fspath = None
    if testcase.get("name"):
        test_name = testcase.get("name").split(".")[-1]
    if testcase.get("classname"):
        test_name = testcase.get("classname").split(".")[-1] + "." + test_name
        backup_fspath = "/".join(testcase.get("classname").split(".")[0:-1])
    return test_name, backup_fspath


@task
def run_junit_import(import_):
    """Import a test run from a JUnit file"""
    # Update the status of the import
    import_record = Import.query.get(import_["id"])
    _update_import_status(import_record, "running")
    # Fetch the file contents
    import_file = ImportFile.query.filter(ImportFile.import_id == import_["id"]).first()
    if not import_file:
        _update_import_status(import_record, "error")
        return
    # Parse the XML and create a run object(s)
    tree = objectify.fromstring(import_file.content)
    import_record.data["run_id"] = []
    # Use current time as start time if no start time is present
    start_time = parser.parse(tree.get("timestamp")) if tree.get("timestamp") else datetime.utcnow()
    run_dict = {
        "created": datetime.utcnow(),
        "start_time": start_time,
        "duration": float(tree.get("time", 0.0)),
        "summary": {
            "errors": int(tree.get("errors", 0)),
            "failures": int(tree.get("failures", 0)),
            "skips": int(tree.get("skipped", 0)),
            "xfailures": int(tree.get("xfailures", 0)),
            "xpasses": int(tree.get("xpasses", 0)),
            "tests": int(tree.get("tests", 0)),
        },
    }

    if import_record.data.get("project_id"):
        run_dict["project_id"] = import_record.data["project_id"]

    metadata = None
    if import_record.data.get("metadata"):
        # metadata is expected to be a json dict
        metadata = import_record.data["metadata"]
        run_dict["data"] = metadata
        # add env and component directly to the run dict if it exists in the metadata
        run_dict["env"] = metadata.get("env")
        run_dict["component"] = metadata.get("component")

    # Insert the run, and then update the import with the run id
    run = Run.from_dict(**run_dict)
    session.add(run)
    session.commit()
    run_dict = run.to_dict()
    import_record.data["run_id"].append(run.id)

    # If the top level "testsuites" element doesn't have these, we'll need to build them manually
    run_data = {
        "duration": 0.0,
        "errors": 0,
        "failures": 0,
        "skips": 0,
        "xfailures": 0,
        "xpasses": 0,
        "tests": 0,
    }

    # Handle structures where testsuite is/isn't the top level tag
    testsuites = _get_ts_element(tree)

    # Run through the test suites and import all the test results
    for ts in testsuites:
        run_data["duration"] += float(ts.get("time", 0.0))
        run_data["errors"] += int(ts.get("errors", 0))
        run_data["failures"] += int(ts.get("failures", 0))
        run_data["skips"] += int(ts.get("skipped", 0))
        run_data["xfailures"] += int(ts.get("xfailures", 0))
        run_data["xpasses"] += int(ts.get("xpasses", 0))
        run_data["tests"] += int(ts.get("tests", 0))

        for testcase in ts.iterchildren(tag="testcase"):
            test_name, backup_fspath = _get_test_name_path(testcase)
            result_dict = {
                "test_id": test_name,
                "start_time": run_dict["start_time"],
                "duration": float(testcase.get("time") or 0),
                "run_id": run.id,
                "metadata": {
                    "run": run.id,
                    "fspath": testcase.get("file") or backup_fspath,
                    "line": testcase.get("line"),
                },
                "params": {},
                "source": ts.get("name"),
            }

            _populate_result_metadata(run_dict, result_dict, import_record, metadata is not None)
            result_dict, traceback = _process_result(result_dict, testcase)

            result = Result.from_dict(**result_dict)
            session.add(result)
            session.commit()
            _add_artifacts(result, testcase, traceback, session)

            if traceback:
                session.add(
                    Artifact(
                        filename="traceback.log",
                        result_id=result.id,
                        data={"contentType": "text/plain", "resultId": result.id},
                        content=traceback,
                    )
                )
            if testcase.find("system-out"):
                system_out = bytes(str(testcase["system-out"]), "utf8")
                session.add(
                    Artifact(
                        filename="system-out.log",
                        result_id=result.id,
                        data={"contentType": "text/plain", "resultId": result.id},
                        content=system_out,
                    )
                )
            if testcase.find("system-err"):
                system_err = bytes(str(testcase["system-err"]), "utf8")
                session.add(
                    Artifact(
                        filename="system-err.log",
                        result_id=result.id,
                        data={"contentType": "text/plain", "resultId": result.id},
                        content=system_err,
                    )
                )
            session.commit()

    # Check if we need to update the run
    if not run.duration:
        run.duration = run_data["duration"]
    if not run.summary["errors"]:
        run.summary["errors"] = run_data["errors"]
    if not run.summary["failures"]:
        run.summary["failures"] = run_data["failures"]
    if not run.summary["skips"]:
        run.summary["skips"] = run_data["skips"]
    if not run.summary["xfailures"]:
        run.summary["xfailures"] = run_data["xfailures"]
    if not run.summary["xpasses"]:
        run.summary["xpasses"] = run_data["xpasses"]
    if not run.summary["tests"]:
        run.summary["tests"] = run_data["tests"]
    session.add(run)
    session.commit()

    # Update the status of the import, now that we're all done
    _update_import_status(import_record, "done")


@task
def run_archive_import(import_):
    """Import a test run from an Ibutsu archive file"""
    # Update the status of the import
    import_record = Import.query.get(str(import_["id"]))
    metadata = None
    if import_record.data.get("metadata"):
        # metadata is expected to be a json dict
        metadata = import_record.data["metadata"]
    _update_import_status(import_record, "running")
    # Fetch the file contents
    import_file = ImportFile.query.filter(ImportFile.import_id == import_["id"]).first()
    if not import_file:
        _update_import_status(import_record, "error")
        return

    # First open the tarball and pull in the results
    run = None
    results = []
    result_artifacts = {}
    current_dir = None
    result = None
    artifacts = []
    start_time = None
    file_object = BytesIO(import_file.content)
    with tarfile.open(mode="r:gz", fileobj=file_object) as tar:
        # run through the files and dirs, skipping the first one as it is the base directory
        for member in tar.getmembers()[1:]:
            if member.isdir() and member.name != current_dir:
                if result:
                    results.append(result)
                    result_artifacts[result["id"]] = artifacts
                artifacts = []
                result = None
            elif member.name.endswith("result.json"):
                result = json.loads(tar.extractfile(member).read())
                result_start_time = result.get("start_time")
                if not start_time or start_time > result_start_time:
                    start_time = result_start_time
            elif member.name.endswith("run.json"):
                run = json.loads(tar.extractfile(member).read())
            elif member.isfile():
                artifacts.append(member)
        if result:
            results.append(result)
            result_artifacts[result["id"]] = artifacts
        run_dict = run or {
            "duration": 0,
            "summary": {
                "errors": 0,
                "failures": 0,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
                "tests": 0,
            },
        }
        # patch things up a bit, if necessary
        if metadata:
            run_dict["metadata"] = run_dict.get("metadata", {})
            run_dict["metadata"].update(metadata)
        if run_dict.get("id"):
            run_dict["id"] = convert_objectid_to_uuid(run_dict["id"])
        _populate_created_times(run_dict, start_time)
        _populate_metadata(run_dict, import_record)

        # If this run has a valid ID, check if this run exists
        if is_uuid(run_dict.get("id")):
            run = session.query(Run).get(run_dict["id"])
        if run:
            run.update(run_dict)
        else:
            run = Run.from_dict(**run_dict)
        session.add(run)
        session.commit()
        import_record.data["run_id"] = [run.id]
        # Now loop through all the results, and create or update them
        for result in results:
            artifacts = result_artifacts.get(result["id"], [])
            _create_result(
                tar,
                run.id,
                result,
                artifacts,
                project_id=run_dict.get("project_id") or import_record.data.get("project_id"),
                metadata=metadata,
            )
    # Update the import record
    _update_import_status(import_record, "done")
    if run:
        update_run.delay(run.id)
