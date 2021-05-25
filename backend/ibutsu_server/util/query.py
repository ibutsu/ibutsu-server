""" Query utilities"""
import re

from ibutsu_server.constants import MAX_PAGE_SIZE
from ibutsu_server.tasks.query import query_task


def query_as_task(function):
    """
    Depending on page_size, runs a query as a task.
    """
    # determine tablename from function name
    # cf. https://regex101.com/r/ywW1xZ/1 for the regex used here
    search_result = re.search(r"^[^_]*_([^_]*)_", function.__name__)
    if search_result:
        tablename = search_result.group(1) + "s"
    else:
        tablename = "results"

    def query(**kwargs):
        if kwargs.get("page_size", 25) > MAX_PAGE_SIZE:
            async_result = query_task.apply_async(
                (
                    kwargs.get("filter_"),
                    kwargs.get("page", 1),
                    kwargs.get("page_size", 25),
                    kwargs.get("estimate", False),
                    tablename,
                )
            )
            response = {
                "task_id": async_result.id,
                "message": f"Due to the page_size: {kwargs.get('page_size')}, "
                f"this query is being evaluated in a task. Once complete, "
                f"the result of the query can be found by performing a GET on"
                f"/task/{async_result.id}",
                "query_endpoint": f"/task/{async_result.id}",
            }
            return response, 201
        else:
            return function(**kwargs)

    return query
