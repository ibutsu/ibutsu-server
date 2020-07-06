from bson import ObjectId
from ibutsu_server.mongo import mongo
from pymongo.errors import OperationFailure

NO_RUN_TEXT = "None"
NO_PASS_RATE_TEXT = "Build failed"


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


def _get_heatmap(job_name, build_number, builds, group_field, count_skips, project=None):
    """Run the aggregation to get the Jenkins heatmap report"""
    # Get the run IDs for the last 5 Jenkins builds
    build_min = build_number - (builds - 1)
    build_max = build_number + 1
    build_range = [str(bnum) for bnum in range(build_min, build_max)]
    aggregation = [
        {
            "$match": {
                "metadata.jenkins.job_name": job_name,
                "metadata.jenkins.build_number": {"$in": build_range},
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
    return heatmap, build_range


def _pad_heatmap(heatmap, build_range):
    """Pad Jenkins runs that are not present with Null"""
    padded_dict = {}
    if not heatmap:
        return heatmap

    for group in heatmap.keys():
        # skip first item in list which contains slope info
        run_list = heatmap[group][1:]
        padded_run_list = []
        completed_runs = {run[2]: run for run in run_list}
        for build in build_range:
            if build not in completed_runs.keys():
                padded_run_list.append((NO_PASS_RATE_TEXT, NO_RUN_TEXT, build))
            else:
                padded_run_list.append(completed_runs[build])
        # add the slope info back in
        padded_run_list.insert(0, heatmap[group][0])
        # write to the padded_dict
        padded_dict[group] = padded_run_list
    return padded_dict


def get_jenkins_heatmap(
    job_name, builds, group_field, sort_field="starttime", count_skips=False, project=None
):
    """Generate JSON data for a heatmap of Jenkins runs"""
    # Get latest build number
    filters = {"metadata.jenkins.job_name": job_name}
    if project:
        filters.update({"metadata.project": project})
    results = mongo.results.find(filters, sort=[(sort_field, -1)], limit=1)
    build_number = int(results[0]["metadata"]["jenkins"]["build_number"])
    try:
        heatmap, build_range = _get_heatmap(
            job_name, build_number, builds, group_field, count_skips, project
        )
    except OperationFailure:
        # Probably a divide by zero exception, roll back one on the build number and try again
        build_number -= 1
        heatmap, build_range = _get_heatmap(
            job_name, build_number, builds, group_field, count_skips, project
        )

    # do some postprocessing -- fill empty runs with null
    heatmap = _pad_heatmap(heatmap, build_range)
    return {"heatmap": heatmap}
