import time
from datetime import timedelta

from ibutsu_server.mongo import mongo


def _get_recent_run_data(weeks, group_field, project=None):
    """Get all the data from the time period and aggregate the results"""
    data = {"passed": {}, "skipped": {}, "error": {}, "failed": {}}
    delta = timedelta(weeks=weeks).total_seconds()
    current_time = time.time()
    time_period_in_sec = current_time - delta
    # now do the aggregation based on the 'group_field'
    pipeline = [
        {
            "$match": {
                "start_time": {"$gte": time_period_in_sec},
                f"{group_field}": {"$exists": "true", "$ne": "null"},
            }
        },
        {
            "$group": {
                "_id": f"${group_field}",
                "tests": {"$sum": "$summary.tests"},
                "failures": {"$sum": "$summary.failures"},
                "skips": {"$sum": "$summary.skips"},
                "errors": {"$sum": "$summary.errors"},
            }
        },
    ]
    if project:
        pipeline[0]["$match"]["metadata.project"] = {"$eq": project}

    aggr = mongo.runs.aggregate(pipeline)

    # some data cleanup
    for i, result in enumerate(aggr):
        # get rid of the `None`
        if not result["_id"]:
            continue
        _id = result["_id"]
        data["failed"][_id] = int(round(100 * float(result["failures"]) / float(result["tests"])))
        data["skipped"][_id] = int(round(100 * float(result["skips"]) / float(result["tests"])))
        data["error"][_id] = int(round(100 * float(result["errors"]) / float(result["tests"])))
        data["passed"][_id] = int(
            100 - (data["failed"][_id] + data["skipped"][_id] + data["error"][_id])
        )
        data["filter"] = f"start_time[gt]={time_period_in_sec}"  # pass along the time for links

    return data


def get_recent_run_data(weeks, group_field, project=None, chart_type="bar"):
    # TODO: Implement line chart by splitting weeks of data into distinct blocks of time
    data = _get_recent_run_data(weeks, group_field, project)
    return data
