from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

from ibutsu_server.db.models import Run
from ibutsu_server.widgets.run_aggregator import get_recent_run_data
from tests.fixtures.constants import MOCK_RESULT_ID, MOCK_RUN_ID
from tests.test_util import MockProject, MockResult

MOCK_ID_2 = "99fba7d2-4d32-4b9b-b07f-4200c9717662"
MOCK_RUN_ID_2 = "8395c072-4724-4dae-9f4a-1407b25a2d5c"
MOCK_PROJECT = MockProject()
START_TIME = datetime.utcnow()
MOCK_RESULTS = [
    MockResult(
        id=MOCK_RESULT_ID,
        duration=6.027456183070403,
        result="passed",
        component="fake-component",
        data={
            "jenkins_build": 145,
            "commit_hash": "F4BA3E12",
            "assignee": "jdoe",
            "component": "fake-component",
            "fspath": "fake_component.py",
        },
        start_time=str(START_TIME),
        source="source",
        params={"provider": "vmware", "ip_stack": "ipv4"},
        test_id="test_id",
        project=MOCK_PROJECT,
    ),
    MockResult(
        id=MOCK_ID_2,
        duration=10.457123453030907,
        result="failed",
        component="fake-component",
        data={
            "jenkins_build": 146,
            "commit_hash": "A11BEF06",
            "assignee": "jdoe",
            "component": "fake-component",
            "fspath": "fake_component.py",
        },
        start_time=str(START_TIME),
        source="source",
        params={"provider": "vmware", "ip_stack": "ipv4"},
        test_id="test_id",
        project=MOCK_PROJECT,
    ),
]

MOCK_RESULTS_DICT = [result.to_dict() for result in MOCK_RESULTS]


def test_get_comparison_result_list(flask_app, auth_headers):
    """Test case for compare_runs_view.py::get_comparison_data"""
    client, jwt_token = flask_app
    MOCK_RUN_IDS = [MOCK_RUN_ID, MOCK_RUN_ID_2]
    MOCKED_RESULTS = [[mocked_result] for mocked_result in MOCK_RESULTS]

    with (
        client.application.app_context(),
        patch("ibutsu_server.widgets.compare_runs_view.Result.query") as mocked_query,
    ):
        mocked_query_return = mocked_query.filter.return_value
        mocked_query_return.with_entities.return_value.order_by.return_value.first.side_effect = (
            MOCK_RUN_IDS
        )
        mocked_query_return.filter.return_value.order_by.return_value.all.side_effect = (
            MOCKED_RESULTS
        )
        query_string = {
            "filters": ["metadata.component=frontend", "metadata.component=frontend"],
        }
        headers = auth_headers(jwt_token)
        response = client.open(
            "/api/widget/compare-runs-view",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
        expected_response = {
            "pagination": {"totalItems": 1},
            "results": [MOCK_RESULTS_DICT],
        }
        assert response.json == expected_response


@patch("ibutsu_server.widgets.run_aggregator.string_to_column")
@patch("ibutsu_server.widgets.run_aggregator.apply_filters")
@patch("ibutsu_server.widgets.run_aggregator.session")
def test_run_aggregator_with_zero_total(
    mocked_session: Mock, mocked_apply_filters: Mock, mocked_string_to_column: Mock
):
    """Test case for run_aggregator handling zero total tests (division by zero)"""
    # GIVEN: Mocked query that returns data with zero total tests
    mocked_string_to_column.return_value = Run.component  # Mock the column
    mocked_apply_filters.side_effect = lambda query, _filters, _run: query

    # Mock the query chain
    mocked_query = MagicMock()
    mocked_grouped_query = MagicMock()
    # Query returns: group, failed, error, skipped, total, xpassed, xfailed
    mocked_grouped_query.all.return_value = [
        ("component-a", 5, 2, 1, 100, 0, 1),  # Valid data
        ("component-b", 0, 0, 0, 0, 0, 0),  # Zero total - should be skipped
        ("component-c", 3, 1, 2, 50, 1, 0),  # Valid data
        ("component-d", 0, 0, 0, None, 0, 0),  # None total - should be skipped
    ]
    mocked_query.group_by.return_value = mocked_grouped_query
    mocked_session.query.return_value = mocked_query

    # WHEN: Getting recent run data
    result = get_recent_run_data(
        weeks=4, group_field="component", project="d13d1301-a663-4b26-a9e5-77364e420c0c"
    )

    # THEN: The result should only contain valid data (components with non-zero totals)
    # component-b and component-d should be skipped due to zero/None totals
    assert "component-a" in result["failed"]
    assert "component-c" in result["failed"]
    assert "component-b" not in result["failed"]
    assert "component-d" not in result["failed"]

    # Verify calculations for component-a (5 failed out of 100 total = 5%)
    assert result["failed"]["component-a"] == 5
    assert result["error"]["component-a"] == 2
    assert result["skipped"]["component-a"] == 1

    # Verify calculations for component-c (3 failed out of 50 total = 6%)
    assert result["failed"]["component-c"] == 6
    assert result["error"]["component-c"] == 2
    assert result["skipped"]["component-c"] == 4


def test_run_aggregator_endpoint_error_handling(flask_app, auth_headers):
    """Test case for widget controller error handling with run-aggregator"""
    client, jwt_token = flask_app
    headers = auth_headers(jwt_token)

    # Test with invalid parameters that might cause errors
    query_string = {
        "weeks": 4,
        "group_field": "component",
        "additional_filters": "",
    }

    # Patch the WIDGET_METHODS dictionary entry
    with patch.dict(
        "ibutsu_server.controllers.widget_controller.WIDGET_METHODS",
        {"run-aggregator": MagicMock(side_effect=ZeroDivisionError("float division by zero"))},
    ):
        response = client.open(
            "/api/widget/run-aggregator",
            method="GET",
            headers=headers,
            query_string=query_string,
        )

        # Should return 500 error with descriptive message
        assert response.status_code == 500
        assert "Error processing widget" in response.data.decode("utf-8")
        assert "run-aggregator" in response.data.decode("utf-8")
