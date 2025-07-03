from collections import defaultdict

from sqlalchemy import desc

from ibutsu_server.db import db
from ibutsu_server.db.models import Result
from ibutsu_server.filters import string_to_column
from ibutsu_server.util.uuid import is_uuid


def _get_results(job_name, builds, components, project):
    if project is None:
        return []
    if not is_uuid(project):
        raise ValueError(f"Invalid project ID format: {project}")
    mdat = string_to_column("metadata.importance", Result).label("importance")
    bnumdat = string_to_column("metadata.jenkins.build_number", Result).label("build_number")
    jnamedat = string_to_column("metadata.jenkins.job_name", Result).label("job_name")
    # Get the last 'builds' runs from a specific Jenkins Job as a subquery
    build_numbers_subquery = (
        db.select(bnumdat.label("build_number"))
        .where(jnamedat == job_name, Result.project_id == project)
        .group_by(bnumdat)
        .order_by(desc(bnumdat))
        .limit(builds)
        .subquery()
    )
    # Actually filter the results based on build_numbers, job_name, project_id and component.
    # Flask-SQLAlchemy 3.0+ pattern
    return db.session.execute(
        db.select(
            Result.component,
            Result.id,
            Result.result,
            mdat,
            bnumdat,
        ).where(
            bnumdat.in_(build_numbers_subquery),
            jnamedat == job_name,
            Result.component.in_(components.split(",")),
            Result.project_id == project,
        )
    ).all()


def get_importance_component(  # noqa: PLR0912
    _env="prod",
    _group_field="component",
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
        if datum.component not in sdatdict:
            sdatdict[datum.component] = {}

        # getting the build numbers from the results
        if datum.build_number not in sdatdict[datum.component]:
            bnums.add(datum.build_number)
            sdatdict[datum.component][datum.build_number] = {}

        # Adding all importances from our constant
        if datum.importance not in sdatdict[datum.component][datum.build_number]:
            sdatdict[datum.component][datum.build_number][datum.importance] = []
        # adding the result value
        sdatdict[datum.component][datum.build_number][datum.importance].append(
            {"result": datum.result, "result_id": datum.id}
        )

    # This adds the extra importance values that didn't appear in the results
    for _component, component_data in sdatdict.items():
        for bnum in component_data:
            for importance in importances:
                if importance not in component_data[bnum]:
                    component_data[bnum][importance] = []

    # this is to change result values into numbers
    for _component, component_data in sdatdict.items():
        for bnum, bnum_data in component_data.items():
            for importance, importance_data in bnum_data.items():
                results_dict = defaultdict(int)
                total = 0
                res_list = []
                for item in importance_data:
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
                    component_data[bnum][importance] = {
                        "percentage": round(passed / total, 2),
                        "result_list": res_list,
                    }
                else:
                    component_data[bnum][importance] = {
                        "percentage": "N/A",
                        "result_list": res_list,
                    }

        for bnum in bnums:
            if bnum not in component_data:
                component_data[bnum] = {}
                for importance in importances:
                    component_data[bnum][importance] = {
                        "percentage": "NA",
                        "result_list": [],
                    }

    # Need this broken down more for the table
    table_data = []
    for key, value in sdatdict.items():
        table_data.append(
            {
                "component": key,
                "bnums": sorted(bnums),
                "importances": importances,
                "data": value,
            }
        )

    # return data, for sanity
    return {"table_data": table_data}
