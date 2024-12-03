from collections import defaultdict

from sqlalchemy import desc

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.filters import string_to_column


def _get_results(job_name, builds, components, project):
    mdat = string_to_column("metadata.importance", Result).label("importance")
    bnumdat = string_to_column("metadata.jenkins.build_number", Result).label("build_number")
    jnamedat = string_to_column("metadata.jenkins.job_name", Result).label("job_name")
    # Get the last 'builds' runs from a specific Jenkins Job as a subquery
    build_numbers_subquery = (
        session.query(bnumdat.label("build_number"))
        .filter(jnamedat == job_name)
        .filter(Result.project_id == project)
        .group_by(bnumdat)
        .order_by(desc(bnumdat))
        .limit(builds)
        .subquery()
    )
    # Actually filter the results based on build_numbers, job_name, project_id and component.
    result_data = (
        Result.query.filter(
            bnumdat.in_(build_numbers_subquery),
            jnamedat == job_name,
            Result.component.in_(components.split(",")),
            Result.project_id == project,
        )
        .add_columns(
            Result.component,
            Result.id,
            Result.result,
            mdat,
            bnumdat,
        )
        .all()
    )
    return result_data


def get_importance_component(
    env="prod",
    group_field="component",
    job_name="",
    builds=5,
    components="",
    project=None,
    count_skips=False,
):
    result_data = _get_results(job_name, builds, components, project)

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
        if datum.build_number not in sdatdict[datum.component].keys():
            bnums.add(datum.build_number)
            sdatdict[datum.component][datum.build_number] = {}

        # Adding all importances from our constant
        if datum.importance not in sdatdict[datum.component][datum.build_number].keys():
            sdatdict[datum.component][datum.build_number][datum.importance] = []
        # adding the result value
        sdatdict[datum.component][datum.build_number][datum.importance].append(
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
                        "percentage": "N/A",
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
