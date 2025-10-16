from datetime import datetime, timedelta, timezone

from ibutsu_server.widgets.run_aggregator import get_recent_run_data

MOCK_WEEKS = 4
MOCK_GROUP_FIELD = "component"


def test_get_recent_run_data(make_project, make_run):
    """Test the get_recent_run_data function with real database."""
    project = make_project(name="test-project")

    # Create run within the time window
    recent_time = datetime.now(timezone.utc) - timedelta(days=7)

    # Run for component1: simple case with only failures
    _run1 = make_run(
        project_id=project.id,
        start_time=recent_time,
        component="component1",
        summary={
            "tests": 100,
            "failures": 10,
            "errors": 5,
            "skips": 2,
            "xpassed": 0,  # Avoid widget bug with xpassed/xfailed
            "xfailed": 0,
        },
    )

    # Run for component2: all passed (50 total)
    _run2 = make_run(
        project_id=project.id,
        start_time=recent_time,
        component="component2",
        summary={
            "tests": 50,
            "failures": 0,
            "errors": 0,
            "skips": 0,
            "xpassed": 0,
            "xfailed": 0,
        },
    )

    # Get the aggregated data
    result = get_recent_run_data(MOCK_WEEKS, MOCK_GROUP_FIELD, str(project.id))

    assert "passed" in result
    assert "failed" in result
    assert "error" in result
    assert "skipped" in result
    assert "component1" in result["passed"]
    assert "component2" in result["passed"]
    # component1: 83% passed (100 - 10 - 5 - 2) # noqa: ERA001
    assert result["passed"]["component1"] == 83
    assert result["failed"]["component1"] == 10
    assert result["error"]["component1"] == 5
    assert result["skipped"]["component1"] == 2
    # component2: 100% passed # noqa: ERA001
    assert result["passed"]["component2"] == 100
