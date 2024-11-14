from collections import defaultdict

from ibutsu_server.constants import BARCHART_MAX_BUILDS, JJV_RUN_LIMIT
from ibutsu_server.db.models import Result, Run
from ibutsu_server.filters import string_to_column
from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view


def get_importance_component(
    env="prod",
    group_field="component",
    job_name="",
    builds=5,
    components="",
    project=None,
    count_skips=False,
):
    # taken from get_jenkins_line_chart in jenkins_job_analysis.py
    run_limit = int((JJV_RUN_LIMIT / BARCHART_MAX_BUILDS) * builds)
    jobs = get_jenkins_job_view(
        filter_=f"job_name={job_name}",
        page_size=builds,
        project=project,
        run_limit=run_limit,
    ).get("jobs")

    # A list of job build numbers to filter our runs by
    job_ids = []
    for job in jobs:
        job_ids.append(job["build_number"])

    # query for RUN ids
    # metadata has to have a string to column to work
    # because it is a sqlalchemy property otherwise (AFAIK)
    bnumdat = string_to_column("metadata.jenkins.build_number", Run)
    run_data = (
        Run.query.filter(bnumdat.in_(job_ids), Run.component.in_(components.split(",")))
        .add_columns(Run.id, bnumdat.label("build_number"))
        .all()
    )

    # get a list of the job IDs
    run_info = {}
    for run in run_data:
        run_info[run.id] = run.build_number

    mdat = string_to_column("metadata.importance", Result)
    result_data = (
        Result.query.filter(
            Result.run_id.in_(run_info.keys()),
            Result.component.in_(components.split(",")),
        )
        .add_columns(
            Result.run_id,
            Result.component,
            Result.id,
            Result.result,
            mdat.label("importance"),
        )
        .all()
    )

    """
    This starts a (probably) over complicated bit of data maniplation
    to get sdatdict in a proper state to be broken down into
    sdatret, which is the format we need for the widget.
    """
    sdatdict = {}
    bnums = set()
    importances = ["critical", "high", "medium", "low"]
    for datum in result_data:
        # getting the components from the results
        if datum.component not in sdatdict.keys():
            sdatdict[datum.component] = {}

        # getting the build numbers from the results
        if run_info[datum.run_id] not in sdatdict[datum.component].keys():
            bnums.add(run_info[datum.run_id])
            sdatdict[datum.component][run_info[datum.run_id]] = {}

        # Adding all importances from our constant
        if datum.importance not in sdatdict[datum.component][run_info[datum.run_id]].keys():
            sdatdict[datum.component][run_info[datum.run_id]][datum.importance] = []
        # adding the result value
        sdatdict[datum.component][run_info[datum.run_id]][datum.importance].append(
            {"result": datum.result, "result_id": datum.id}
        )

    # This adds the extra importance values that didn't appear in the results
    for component in sdatdict.keys():
        for bnum in sdatdict[component].keys():
            for importance in importances:
                if importance not in sdatdict[component][bnum].keys():
                    sdatdict[component][bnum][importance] = []

    # this is to change result values into numbers
    for component in sdatdict.keys():
        for bnum in sdatdict[component].keys():
            for importance in sdatdict[component][bnum].keys():
                results_dict = defaultdict(int)
                total = 0
                res_list = []
                for item in sdatdict[component][bnum][importance]:
                    total += 1
                    results_dict[item["result"]] += 1
                    res_list.append(item["result_id"])

                if total != 0:
                    if count_skips:
                        passed = total - (
                            results_dict["error"]
                            + results_dict["skipped"]
                            + results_dict["failed"]
                            + results_dict["xpassed"]
                            + results_dict["xfailed"]
                        )
                    else:
                        passed = total - (
                            results_dict["error"]
                            + results_dict["failed"]
                            + results_dict["xpassed"]
                            + results_dict["xfailed"]
                        )
                    sdatdict[component][bnum][importance] = {
                        "percentage": round(passed / total, 2),
                        "result_list": res_list,
                    }
                else:
                    sdatdict[component][bnum][importance] = {
                        "percentage": 0,
                        "result_list": res_list,
                    }

        for bnum in bnums:
            if bnum not in sdatdict[component].keys():
                sdatdict[component][bnum] = {}
                for importance in importances:
                    sdatdict[component][bnum][importance] = {
                        "percentage": "NA",
                        "result_list": [],
                    }

    # Need this broken down more for the table
    table_data = []
    for key in sdatdict.keys():
        table_data.append(
            {
                "component": key,
                "bnums": sorted(list(bnums)),
                "importances": importances,
                "data": sdatdict[key],
            }
        )

    # return data, for sanity
    data = {"table_data": table_data}
    return data
