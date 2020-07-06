import time
from datetime import timedelta

from ibutsu_server.mongo import mongo


def _get_min_count(days):
    if days <= 1:
        return 2e2 * days
    else:
        return days ** 5


def _get_recent_result_data(days, group_field, project=None):
    """ Count occurrences of distinct fields within results.
    """
    delta = timedelta(days=days).total_seconds()
    current_time = time.time()
    time_period_in_sec = current_time - delta
    # now do the aggregation based on the 'group_field'
    # just count the number of tests for each entry of 'group_field'
    pipeline = [
        {
            "$match": {
                "start_time": {"$gte": time_period_in_sec},
                f"{group_field}": {"$exists": "true", "$ne": "null"},
            }
        },
        {"$unwind": f"${group_field}"},
        {"$group": {"_id": f"${group_field}", "count": {"$sum": 1}}},
        # so that too many results with minimal counts are not displayed,
        {"$match": {"count": {"$gte": _get_min_count(days)}}},
        {"$sort": {"count": -1}},
    ]
    if project:
        pipeline[0]["$match"]["metadata.project"] = {"$eq": project}
    return list(mongo.results.aggregate(pipeline))


def get_recent_result_data(days, group_field, project=None, chart_type="pie"):
    data = _get_recent_result_data(days, group_field, project)
    return data
