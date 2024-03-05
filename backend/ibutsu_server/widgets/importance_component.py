#TODO: delete unneeded imports
# import yaml
from ibutsu_server.db.models import Run
from ibutsu_server.db.models import Result
from ibutsu_server.constants import BARCHART_MAX_BUILDS
# from ibutsu_server.constants import HEATMAP_MAX_BUILDS
from ibutsu_server.constants import JJV_RUN_LIMIT
from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view
# from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_viewid
# from ibutsu_server.db.base import session
# from sqlalchemy import func
# from ibutsu_server.filters import apply_filters
from ibutsu_server.filters import string_to_column
# from ibutsu_server.db.base import Text

#TODO: these were mocked methods, delete if unused
"""
def get_runs_from_job(job, additional_filters):
    # Get a list of runs from the job, trim based on filters
    # this can be imported/copied from the jenkins analysis view
    pass


def get_results_from_runs(run_list):
    # Get a list of results from a list of runs
    # this can be specifially tailored to return one already
    # sorted by component, can genericize later
    pass
"""


def get_importance_component(env="prod",
                             group_field="component",
                             job_name="",
                             components=None,
                             project=None):
    # tmp parameters
    #TODO: decide if this should be an optional parameter or hard coded
    builds = 5

    # taken from get_jenkins_line_chart in jenkins_job_analysis.py
    run_limit = int((JJV_RUN_LIMIT / BARCHART_MAX_BUILDS) * builds)
    jobs = get_jenkins_job_view(
        filter_=f"job_name={job_name}",
        page_size=builds,
        project=project,
        run_limit=run_limit
    ).get("jobs")

    # A list of job build numbers to filter our runs by
    job_ids = []
    for job in jobs:
        job_ids.append(job["build_number"])

    # query for RUN ids
    # metadata has to have a string to column to work
    # because it is a sqlalchemy property otherwise (AFAIK)
    bnumdat = string_to_column("metadata.jenkins.build_number", Run)
    run_data = Run.query.filter(
        bnumdat.in_(job_ids),
        Run.component.in_(components.split(','))
    ).add_columns(
        Run.id,
        bnumdat.label("build_number")
    ).all()

    # get a list of the job IDs
    run_info = {}
    for run in run_data:
        run_info[run.id] = run.build_number

    mdat = string_to_column("metadata.importance", Result)
    result_data = Result.query.filter(
        Result.run_id.in_(run_info.keys()),
        Result.component.in_(
            components.split(','))).add_columns(
                Result.run_id,
                Result.component,
                Result.id,
                Result.result,
                mdat.label("importance")
    ).all()

    #TODO: remove this when no longer needed for reference
    """
    sdatdict gonna look like
    {"platfor_ui":
        {"build451":
            {"critical":
                [results list],
             "high":
                [results list],
            ...
        },
        {"build452":
            {"critical":
                ...
            }
        },
     "rbac_frontend":
        {...
        }
    }
    """

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
        sdatdict[datum.component][run_info[datum.run_id]][datum.importance].append({"result": datum.result, "result_id": datum.id})

    # This adds the extra importance values that didn't appear in the results
    for component in sdatdict.keys():
        for bnum in sdatdict[component].keys():
            for importance in importances:
                if importance not in sdatdict[component][bnum].keys():
                    sdatdict[component][bnum][importance] = []

    # this is to change result values into numbers
    #TODO: This doesn't handle xpassed, xfailed, skipped, etc. so figure that out
    for component in sdatdict.keys():
        for bnum in sdatdict[component].keys():
            for importance in sdatdict[component][bnum].keys():
                total = 0
                passed = 0
                res_list = []
                for item in sdatdict[component][bnum][importance]:
                    total += 1
                    res_list.append(item["result_id"])
                    if item["result"] == "passed":
                        passed += 1

                if total != 0:
                    sdatdict[component][bnum][importance] = {"percentage": round(passed / total, 2), "result_list": res_list}
                else:
                    sdatdict[component][bnum][importance] = {"percentage": 0, "result_list": res_list}

        for bnum in bnums:
            if bnum not in sdatdict[component].keys():
                sdatdict[component][bnum] = {}
                for importance in importances:
                    sdatdict[component][bnum][importance] = {"percentage": "NA", "result_list": []}

    # Need this broken down more for the table
    sdatret = []
    for key in sdatdict.keys():
        sdatret.append({"component": key,
                        "bnums": sorted(list(bnums)),
                        "importances": importances,
                        "data": sdatdict[key]})

    # return data, for sanity
    data = {"testa": group_field,
            "testb": components,
            "testc": project,
            "sdatnew": sdatret,
            #TODO: remove tmpdat here and in frontend, just used for troubleshooting
            "tmpdat": sorted(["lol"])}
    return data
