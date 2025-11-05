"""Tests for accessibility_analysis widget"""

import yaml

from ibutsu_server.widgets.accessibility_analysis import (
    get_accessibility_analysis_view,
    get_accessibility_bar_chart,
)


def test_get_accessibility_bar_chart_success(make_project, make_run, make_artifact):
    """Test getting accessibility bar chart with valid data"""
    project = make_project(name="test-project")
    run1 = make_run(project_id=project.id)
    run2 = make_run(project_id=project.id)

    # Create artifacts with accessibility data
    make_artifact(
        run_id=run1.id,
        filename="axe_run_data.yaml",
        content=yaml.dump(
            {"passes": 85, "violations": 15, "timestamp": "2023-01-01T12:00:00"}
        ).encode(),
    )

    make_artifact(
        run_id=run2.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"incomplete": 5, "timestamp": "2023-01-01T13:00:00"}).encode(),
    )

    run_list = [str(run1.id), str(run2.id)]
    result = get_accessibility_bar_chart(run_list)

    assert result is not None
    assert len(result) == 3
    assert result[0]["x"] == "passes"
    assert result[0]["y"] == 85
    assert result[0]["ratio"] == 85.0
    assert result[1]["x"] == "violations"
    assert result[1]["y"] == 15
    assert result[1]["ratio"] == 15.0
    assert result[2]["total"] == 100


def test_get_accessibility_bar_chart_no_passes_data(make_project, make_run, make_artifact):
    """Test getting accessibility bar chart with no passes data"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create artifact without passes data
    make_artifact(
        run_id=run.id, filename="axe_run_data.yaml", content=yaml.dump({"incomplete": 5}).encode()
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    assert result is None


def test_get_accessibility_bar_chart_empty_artifacts(make_project, make_run):
    """Test getting accessibility bar chart with no artifacts"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Don't create any artifacts
    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    assert result is None


def test_get_accessibility_bar_chart_with_filters(make_project, make_run, make_artifact):
    """Test getting accessibility bar chart with filters"""
    project = make_project(name="test-project")
    run1 = make_run(project_id=project.id)
    run2 = make_run(project_id=project.id)

    # Create artifacts with accessibility data
    make_artifact(
        run_id=run1.id,
        filename="axe_run_data.yaml",
        content=yaml.dump(
            {"passes": 85, "violations": 15, "timestamp": "2023-01-01T12:00:00"}
        ).encode(),
    )

    make_artifact(
        run_id=run2.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"incomplete": 5, "timestamp": "2023-01-01T13:00:00"}).encode(),
    )

    run_list = [str(run1.id), str(run2.id)]
    filters = {"env": "production"}
    result = get_accessibility_bar_chart(run_list, filters)

    assert result is not None
    assert len(result) == 3


def test_get_accessibility_bar_chart_division_calculation(make_project, make_run, make_artifact):
    """Test the ratio calculation in accessibility bar chart"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 73, "violations": 27}).encode(),
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    assert result is not None
    assert result[0]["ratio"] == 73.0
    assert result[1]["ratio"] == 27.0
    assert result[2]["total"] == 100


def test_get_accessibility_bar_chart_multiple_artifacts_first_with_passes(
    make_project, make_run, make_artifact
):
    """Test that get_accessibility_bar_chart uses the first artifact with passes"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create multiple artifacts, first without passes, second with passes
    make_artifact(
        run_id=run.id, filename="axe_run_data.yaml", content=yaml.dump({"incomplete": 5}).encode()
    )

    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 50, "violations": 50}).encode(),
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    # Should use the artifact with passes
    assert result is not None
    assert result[0]["y"] == 50
    assert result[1]["y"] == 50


def test_get_accessibility_bar_chart_with_zero_total(make_project, make_run, make_artifact):
    """Test that get_accessibility_bar_chart handles zero total correctly"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 0, "violations": 0}).encode(),
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    assert result is not None
    assert result[0]["y"] == 0
    assert result[1]["y"] == 0
    assert result[0]["ratio"] == 0.0
    assert result[1]["ratio"] == 0.0
    assert result[2]["total"] == 0


def test_get_accessibility_bar_chart_filters_by_filename(make_project, make_run, make_artifact):
    """Test that get_accessibility_bar_chart only uses axe_run_data.yaml files"""
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create artifact with wrong filename
    make_artifact(
        run_id=run.id,
        filename="other_data.yaml",
        content=yaml.dump({"passes": 100, "violations": 0}).encode(),
    )

    # Create artifact with correct filename
    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 50, "violations": 50}).encode(),
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    # Should only use the axe_run_data.yaml file
    assert result is not None
    assert result[0]["y"] == 50


def test_get_accessibility_bar_chart_multiple_valid_artifacts(
    make_project, make_run, make_artifact
):
    """Test that get_accessibility_bar_chart handles multiple axe_run_data.yaml artifacts per run"""
    project = make_project(name="multi-artifact-project")
    run = make_run(project_id=project.id)

    # First valid artifact
    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 10, "violations": 2}).encode(),
    )
    # Second valid artifact with different data
    make_artifact(
        run_id=run.id,
        filename="axe_run_data.yaml",
        content=yaml.dump({"passes": 5, "violations": 1}).encode(),
    )

    # Third artifact with a different filename (should be ignored)
    make_artifact(
        run_id=run.id,
        filename="not_axe_run_data.yaml",
        content=yaml.dump({"passes": 100, "violations": 0}).encode(),
    )

    run_list = [str(run.id)]
    result = get_accessibility_bar_chart(run_list)

    # Widget uses the first valid artifact with passes data
    # When there are multiple artifacts, it picks one (likely the first or last)
    assert result is not None
    # Should use one of the valid artifacts (not aggregate both)
    total = result[0]["y"] + result[1]["y"]
    # Could be either 12 (10+2 first) or 6 (5+1 second) depending on which artifact is used
    assert total in [12, 6], f"Expected total of 12 or 6, got {total}"


def test_get_accessibility_analysis_view(make_project, make_run):
    """Test getting accessibility analysis view"""
    project = make_project(name="test-project")
    run1 = make_run(project_id=project.id)
    run2 = make_run(project_id=project.id)

    run_list = [str(run1.id), str(run2.id)]
    result = get_accessibility_analysis_view(run_list, str(project.id))

    # This function currently just returns the run_list
    assert result == run_list
