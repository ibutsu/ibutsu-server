import yaml

from ibutsu_server.db.models import Artifact


def get_accessibility_bar_chart(run_list, _filters=None):
    """
    This takes data from an accessibility run's 'axe_run_data.yaml' file
    and converts it into a format that can be used with a pie chart.
    """
    query_data = Artifact.query.filter(
        Artifact.run_id.in_(run_list), Artifact.filename == "axe_run_data.yaml"
    ).all()

    axe_datas = []
    for datum in query_data:
        axe_datas.append(yaml.safe_load(datum.content))
    # parse the data for the frontend
    # this format is specific to the patternfly donut chart
    axe_data = None
    for data in axe_datas:
        if "passes" in data:
            axe_data = data
    if axe_data is None:
        return axe_data
    total = axe_data["passes"] + axe_data["violations"]
    # Guard against division by zero
    if total == 0:
        return [
            {"x": "passes", "y": 0, "ratio": 0.0},
            {"x": "violations", "y": 0, "ratio": 0.0},
            {"total": 0},
        ]
    return [
        {
            "x": "passes",
            "y": axe_data["passes"],
            "ratio": round((100 * axe_data["passes"]) / total, 2),
        },
        {
            "x": "violations",
            "y": axe_data["violations"],
            "ratio": round((100 * axe_data["violations"]) / total, 2),
        },
        {"total": total},
    ]


def get_accessibility_analysis_view(run_list, _project=None):
    return run_list
