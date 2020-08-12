from datetime import datetime

import connexion
from bson import ObjectId
from ibutsu_server.filters import generate_filter_object
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.runs import update_run as update_run_task
from ibutsu_server.util import merge_dicts
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id
from lxml import objectify
from pymongo import DESCENDING


def get_run_list(filter_=None, page=1, page_size=25):
    """Get a list of runs

    The `filter` parameter takes a list of filters to apply in the form of:

        {name}{operator}{value}

    where:

      - `name` is any valid column in the database
      - `operator` is one of `=`, `!`, `>`, `<`, `)`, `(`, `~`, `*`
      - `value` is what you want to filter by

    Operators are simple correspondents to MongoDB's query selectors:

      - `=` becomes `$eq`
      - `!` becomes `$ne`
      - `>` becomes `$gt`
      - `<` becomes `$lt`
      - `)` becomes `$gte`
      - `(` becomes `$lte`
      - `~` becomes `$regex`
      - `*` becomes `$in`
      - `@` becomes `$exists`

    Notes:

    - For the `$exists` operator, "true", "t", "yes", "y" and `1` will all be considered true,
      all other values are considered false.

    Example queries:

        /result?filter=metadata.run=63fe5
        /result?filter=test_id~neg
        /result?filter=result!passed


    :param filter: A list of filters to apply
    :param page_size: Limit the number of results returned, defaults to 25
    :param page: Offset the results list, defaults to 0

    :rtype: List[Run]
    """
    filters = {}
    if filter_:
        for filter_string in filter_:
            filter_obj = generate_filter_object(filter_string)
            if filter_obj:
                filters.update(filter_obj)
    offset = (page * page_size) - page_size
    total_items = mongo.runs.count(filters)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    runs = mongo.runs.find(filters, skip=offset, limit=page_size, sort=[("created", DESCENDING)])
    return {
        "runs": [serialize(run) for run in runs],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def get_run(id_):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    run = mongo.runs.find_one({"_id": ObjectId(id_)})
    return serialize(run)


def add_run(run=None):
    """Create a new run

    :param body: Run object
    :type body: dict | bytes

    :rtype: Run
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    run_dict = connexion.request.get_json()
    current_time = datetime.utcnow()
    if "created" not in run_dict:
        run_dict["created"] = current_time.isoformat()
    if "start_time" not in run_dict:
        run_dict["start_time"] = current_time.timestamp()
    if "id" in run_dict:
        run_dict["_id"] = ObjectId(run_dict["id"])
    if run_dict.get("metadata") and run_dict.get("metadata", {}).get("project"):
        run_dict["metadata"]["project"] = get_project_id(run_dict["metadata"]["project"])
    mongo.runs.insert_one(run_dict)
    run_dict = serialize(run_dict)
    update_run_task.apply_async((run_dict["id"],), countdown=5)
    return run_dict, 201


def update_run(id_, run=None):
    """Updates a single run

    :param id: ID of run to update
    :type id: int
    :param body: Run
    :type body: dict

    :rtype: Run
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    run = connexion.request.get_json()
    if run.get("metadata") and run.get("metadata", {}).get("project"):
        run["metadata"]["project"] = get_project_id(run["metadata"]["project"])
    existing_run = mongo.runs.find_one({"_id": ObjectId(id_)})
    merge_dicts(existing_run, run)
    mongo.runs.replace_one({"_id": ObjectId(id_)}, run)
    update_run_task.apply_async((id_,), countdown=5)
    return serialize(run)


def import_run(xml_file):
    """Imports a JUnit XML file and creates a test run and results from it.

    :param xmlFile: file to upload
    :type xmlFile: werkzeug.datastructures.FileStorage

    :rtype: Run
    """
    if not xml_file:
        return "Bad request, no file uploaded", 400
    tree = objectify.parse(xml_file.stream)
    root = tree.getroot()
    run_dict = {
        "duration": root.get("time"),
        "summary": {
            "errors": root.get("errors"),
            "failures": root.get("failures"),
            "skips": root.get("skips"),
            "tests": root.get("tests"),
        },
    }
    if run_dict.get("metadata", {}).get("project"):
        run_dict["metadata"]["project"] = get_project_id(run_dict["metadata"]["project"])
    rec = mongo.runs.insert_one(run_dict)
    run_dict["id"] = str(run_dict.pop("_id"))
    for testcase in root.testcase:
        test_name = testcase.get("name").split(".")[-1]
        if testcase.get("classname"):
            test_name = testcase.get("classname").split(".")[-1] + "." + test_name
        result_dict = {
            "test_id": test_name,
            "start_time": 0,
            "duration": float(testcase.get("time")),
            "metadata": {
                "run": run_dict["id"],
                "fspath": testcase.get("file"),
                "line": testcase.get("line"),
            },
            "params": {},
            "source": root.get("name"),
        }
        traceback = None
        if testcase.find("failure"):
            result_dict["result"] = "failed"
            traceback = bytes(str(testcase.failure), "utf8")
        elif testcase.find("error"):
            result_dict["result"] = "error"
            traceback = bytes(str(testcase.error), "utf8")
        else:
            result_dict["result"] = "passed"
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
    return run_dict, 201
