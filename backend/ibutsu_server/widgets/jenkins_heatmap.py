from bson import ObjectId
from ibutsu_server.mongo import mongo
from pymongo import DESCENDING

NO_RUN_TEXT = "None"
NO_PASS_RATE_TEXT = "Build failed"
HEATMAP_RUN_LIMIT = 2000  # approximately no. plugins * 40 + wiggle room


def _calculate_slope(x_data):
    """Calculate the trend slope of the data

    :param x_data: A list of the result percentages, e.g. [98, 54, 97, 99]
    :type x_data: list

    :rtype float:
    """
    if all(x == 100 for x in x_data):
        return 100
    y_data = list(range(len(x_data)))
    x_avg = sum(x_data) / len(x_data)
    y_avg = sum(y_data) / len(y_data)
    try:
        slope = sum([(x - x_avg) * (y - y_avg) for x, y in zip(x_data, y_data)]) / sum(
            [(x - x_avg) ** 2 for x in x_data]
        )
    except ZeroDivisionError:
        slope = 0
    return slope


def _get_builds(job_name, builds, project=None):
    """ Gets the number of unique builds in the DB """
    aggregation = [
        {
            "$match": {
                "metadata.jenkins.job_name": job_name,
                "metadata.jenkins.build_number": {"$exists": True},
            }
        },
        {"$sort": {"start_time": DESCENDING}},
        {"$limit": HEATMAP_RUN_LIMIT},
        {"$group": {"_id": "$metadata.jenkins.build_number"}},
        {"$sort": {"_id": DESCENDING}},
        {"$limit": builds},
    ]
    if project:
        aggregation[0]["$match"].update({"metadata.project": project})
    builds = list(mongo.runs.aggregate(aggregation))
    return [str(build["_id"]) for build in builds]


def _get_heatmap(job_name, builds, group_field, count_skips, project=None):
    """Run the aggregation to get the Jenkins heatmap report"""
    # Get the run IDs for the last 5 Jenkins builds
    builds_in_db = _get_builds(job_name, builds, project)
    aggregation = [
        {
            "$match": {
                "metadata.jenkins.job_name": job_name,
                "metadata.jenkins.build_number": {"$in": builds_in_db},
            }
        },
        {
            "$group": {
                "_id": "$metadata.run",
                "build_number": {"$first": "$metadata.jenkins.build_number"},
            }
        },
    ]
    if project:
        aggregation[0]["$match"].update({"metadata.project": project})

    cursor = mongo.results.aggregate(aggregation)

    runs = [run for run in cursor]
    run_to_build = {str(run["_id"]): run["build_number"] for run in runs}
    # Figure out the pass rates for each run
    fail_fields = ["$summary.errors", "$summary.failures"]
    if count_skips:
        fail_fields.append("$summary.skips")
    pipeline = [
        {"$match": {"_id": {"$in": [ObjectId(run["_id"]) for run in runs]}}},
        {
            "$project": {
                "_id": True,
                "metadata": True,
                "pass_rate": {
                    "$multiply": [
                        {
                            "$cond": {
                                "if": {"$eq": ["$summary.tests", 0]},
                                "then": 0,
                                "else": {
                                    "$divide": [
                                        {"$subtract": ["$summary.tests", {"$add": fail_fields}]},
                                        "$summary.tests",
                                    ]
                                },
                            }
                        },
                        100,
                    ]
                },
            }
        },
        {
            "$group": {
                "_id": f"${group_field}",
                "pass_rate": {"$push": "$pass_rate"},
                "run_ids": {"$push": "$_id"},
            }
        },
    ]
    # Now calculate the slopes (angle of the trend line, essentially)
    aggr = [r for r in mongo.runs.aggregate(pipeline)]
    heatmap = {
        run["_id"]: [(_calculate_slope(run["pass_rate"]), 0)]
        + [
            (pass_rate, str(run_id), run_to_build[str(run_id)])
            for pass_rate, run_id in zip(run["pass_rate"], run["run_ids"])
        ]
        for run in aggr
        if run["_id"] is not None
    }
    # get the build numbers that actually exist in the DB
    return heatmap, builds_in_db


def _pad_heatmap(heatmap, builds_in_db):
    """Pad Jenkins runs that are not present with Null"""
    padded_dict = {}
    if not heatmap:
        return heatmap

    for group in heatmap.keys():
        # skip first item in list which contains slope info
        run_list = heatmap[group][1:]
        padded_run_list = []
        completed_runs = {run[2]: run for run in run_list}
        for build in builds_in_db:
            if build not in completed_runs.keys():
                padded_run_list.append((NO_PASS_RATE_TEXT, NO_RUN_TEXT, build))
            else:
                padded_run_list.append(completed_runs[build])
        # add the slope info back in
        padded_run_list.insert(0, heatmap[group][0])
        # sort the list and then write to the padded_dict
        padded_run_list.sort(key=lambda e: int(e[-1]))
        padded_dict[group] = padded_run_list
    return padded_dict


def get_jenkins_heatmap(
    job_name, builds, group_field, sort_field="starttime", count_skips=False, project=None
):
    """Generate JSON data for a heatmap of Jenkins runs"""
    heatmap, builds_in_db = _get_heatmap(job_name, builds, group_field, count_skips, project)
    # do some postprocessing -- fill runs in which plugins failed to start with null
    heatmap = _pad_heatmap(heatmap, builds_in_db)
    return {"heatmap": heatmap}
