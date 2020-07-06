import json
import tarfile
import time
from datetime import datetime

from bson import ObjectId
from dateutil import parser
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import task
from ibutsu_server.tasks.runs import update_run
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id
from lxml import objectify


def _create_result(tar, run_id, result, artifacts):
    """Create a result with artifacts, used in the archive importer"""
    old_id = None
    result["metadata"]["run"] = run_id
    if ObjectId.is_valid(result["id"]):
        mongo.results.replace_one({"_id": ObjectId(result["id"])}, result)
    else:
        if result.get("id"):
            old_id = result.pop("id")
        mongo.results.insert_one(result)
    result = serialize(result)
    for artifact in artifacts:
        mongo.fs.upload_from_stream(
            "traceback.log",
            tar.extractfile(artifact),
            metadata={"contentType": "text/plain", "resultId": str(result["id"])},
        )
    return old_id


@task()
def run_junit_import(import_):
    """Import a test run from a JUnit file"""
    # Update the status of the import
    import_["status"] = "running"
    mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
    # Fetch the file contents
    try:
        import_file = [f for f in mongo.import_files.find({"metadata.importId": import_["id"]})][0]
    except KeyError:
        import_["status"] = "error"
        mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
        return
    # Parse the XML and create a run object(s)
    tree = objectify.parse(import_file)
    root = tree.getroot()
    import_["run_id"] = []
    for testsuite in root.testsuite:
        run_dict = {
            "created": datetime.fromtimestamp(time.time()).isoformat(),
            "start_time": parser.parse(testsuite.get("timestamp")).strftime("%s"),
            "duration": testsuite.get("time"),
            "summary": {
                "errors": testsuite.get("errors"),
                "failures": testsuite.get("failures"),
                "skips": testsuite.get("skipped"),
                "tests": testsuite.get("tests"),
            },
        }
        # Insert the run, and then update the import with the run id
        mongo.runs.insert_one(run_dict)
        run_dict = serialize(run_dict)
        import_["run_id"].append(run_dict["id"])
        mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
        # Import the contents of the XML file
        for testcase in testsuite.testcase:
            test_name = testcase.get("name").split(".")[-1]
            if testcase.get("classname"):
                test_name = testcase.get("classname").split(".")[-1] + "." + test_name
            result_dict = {
                "test_id": test_name,
                "start_time": run_dict["start_time"],
                "duration": float(testcase.get("time")),
                "metadata": {
                    "run": run_dict["id"],
                    "fspath": testcase.get("file"),
                    "line": testcase.get("line"),
                },
                "params": {},
                "source": testsuite.get("name"),
            }
            skip_reason, traceback = None, None
            if testcase.find("failure"):
                result_dict["result"] = "failed"
                traceback = bytes(str(testcase.failure), "utf8")
            elif testcase.find("error"):
                result_dict["result"] = "error"
                traceback = bytes(str(testcase.error), "utf8")
            elif testcase.find("skipped"):
                result_dict["result"] = "skipped"
                skip_reason = str(testcase.skipped)
            else:
                result_dict["result"] = "passed"

            if skip_reason:
                result_dict["metadata"]["skip_reason"] = skip_reason

            rec = mongo.results.insert_one(result_dict)

            if traceback:
                mongo.fs.upload_from_stream(
                    "traceback.log",
                    traceback,
                    metadata={"contentType": "text/plain", "resultId": str(rec.inserted_id)},
                )

            if testcase.find("system-out"):
                system_out = bytes(str(testcase["system-out"]), "utf8")
                mongo.fs.upload_from_stream(
                    "system-out.log",
                    system_out,
                    metadata={"contentType": "text/plain", "resultId": str(rec.inserted_id)},
                )
            if testcase.find("system-err"):
                system_err = bytes(str(testcase["system-err"]), "utf8")
                mongo.fs.upload_from_stream(
                    "system-err.log",
                    system_err,
                    metadata={"contentType": "text/plain", "resultId": str(rec.inserted_id)},
                )
    import_["status"] = "done"
    mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)


@task()
def run_archive_import(import_):
    """Import a test run from an Ibutsu archive file"""
    # Update the status of the import
    import_["status"] = "running"
    mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
    # Fetch the file contents
    try:
        import_file = [f for f in mongo.import_files.find({"metadata.importId": import_["id"]})][0]
    except KeyError:
        import_["status"] = "error"
        mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
        return

    # First open the tarball and pull in the results
    run = None
    run_dict = None
    results = []
    result_artifacts = {}
    current_dir = None
    result = None
    artifacts = []
    start_time = None
    with tarfile.open(mode="r:gz", fileobj=import_file) as tar:
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
                result_start_time = result.get("start_time", result.get("starttime"))
                if not start_time or start_time > result_start_time:
                    start_time = result_start_time
            elif member.name.endswith("run.json"):
                run = json.loads(tar.extractfile(member).read())
            elif member.isfile():
                artifacts.append(member)
        if result:
            results.append(result)
            result_artifacts[result["id"]] = artifacts
        if run:
            run_dict = run
        else:
            run_dict = {
                "duration": 0,
                "summary": {"errors": 0, "failures": 0, "skips": 0, "tests": 0},
            }
        # patch things up a bit, if necessary
        if run_dict.get("start_time") and not run_dict.get("created"):
            run_dict["created"] = run_dict["start_time"]
        elif run_dict.get("created") and not run_dict.get("start_time"):
            run_dict["start_time"] = run_dict["created"]
        elif not run_dict.get("created") and not run_dict.get("start_time"):
            run_dict["created"] = start_time
            run_dict["start_time"] = start_time
        if run_dict.get("metadata", {}).get("project"):
            run_dict["metadata"]["project"] = get_project_id(run_dict["metadata"]["project"])
        # If this run has a valid ObjectId, check if this run exists
        run_exists = False
        if run_dict.get("id") and ObjectId.is_valid(run_dict["id"]):
            # Just check if this exists first
            run_exists = mongo.runs.find_one({"_id": ObjectId(run_dict["id"])}) is not None
        if run_exists:
            mongo.run_dicts.replace_one({"_id": ObjectId(run_dict["id"])}, run_dict)
        else:
            if run_dict.get("id"):
                del run_dict["id"]
            mongo.runs.insert_one(run_dict)
        run_dict = serialize(run_dict)
        import_["run_id"] = run_dict["id"]
        # Now loop through all the results, and create or update them
        for result in results:
            artifacts = result_artifacts.get(result["id"], [])
            _create_result(tar, run_dict["id"], result, artifacts)
    # Update the import record
    import_["status"] = "done"
    mongo.imports.replace_one({"_id": ObjectId(import_["id"])}, import_)
    if run_dict:
        update_run.delay(run_dict["id"])
