import time

import connexion
from bson import ObjectId
from ibutsu_server.filters import generate_filter_object
from ibutsu_server.mongo import mongo
from ibutsu_server.util import merge_dicts
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id
from pymongo import DESCENDING


def add_result(result=None):
    """Creates a test result

    :param body: Result item
    :type body: dict | bytes

    :rtype: Result
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    result = connexion.request.get_json()
    if result.get("metadata", {}).get("project"):
        result["metadata"]["project"] = get_project_id(result["metadata"]["project"])
    if "start_time" not in result:
        if "starttime" in result:
            result["start_time"] = result["starttime"]
        else:
            result["start_time"] = time.time()
    mongo.results.insert_one(result)
    return serialize(result), 201


def get_result_list(filter_=None, page=1, page_size=25):
    """Gets all results

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

    Note:

    For the `$exists` operator, "true", "t", "yes", "y" and `1` will all be considered true,
    all other values are considered false.


    Example queries:

        /result?filter=metadata.run=63fe5
        /result?filter=test_id~neg
        /result?filter=result!passed


    :param filter: A list of filters to apply
    :param pageSize: Limit the number of results returned, defaults to 25
    :param page: Offset the results list, defaults to 0

    :rtype: List[Result]
    """
    filters = {}
    if filter_:
        for filter_string in filter_:
            filter_obj = generate_filter_object(filter_string)
            if filter_obj:
                filters.update(filter_obj)
    offset = (page * page_size) - page_size
    total_items = mongo.results.count(filters)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    results = mongo.results.find(
        filters, skip=offset, limit=page_size, sort=[("start_time", DESCENDING)]
    )
    return {
        "results": [serialize(result) for result in results],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def get_result(id_):
    """Get a single result

    :param id: ID of Result to return
    :type id: int

    :rtype: Result
    """
    result = mongo.results.find_one({"_id": ObjectId(id_)})
    return serialize(result)


def update_result(id_, result=None):
    """Updates a single result

    :param id: ID of result to update
    :type id: int
    :param body: Result
    :type body: dict

    :rtype: Result
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    result = connexion.request.get_json()
    if result.get("metadata", {}).get("project"):
        result["metadata"]["project"] = get_project_id(result["metadata"]["project"])
    existing_result = mongo.results.find_one({"_id": ObjectId(id_)})
    merge_dicts(existing_result, result)
    mongo.results.replace_one({"_id": ObjectId(id_)}, result)
    return serialize(result)
