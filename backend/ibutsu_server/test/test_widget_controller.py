from datetime import datetime
from unittest.mock import patch

from ibutsu_server.test import BaseTestCase, MockProject, MockResult

MOCK_ID_1 = "99fba7d2-4d32-4b9b-b07f-4200c9717661"
MOCK_ID_2 = "99fba7d2-4d32-4b9b-b07f-4200c9717662"
MOCK_RUN_ID_1 = "8395c072-4724-4dae-9f4a-1407b25a2d5b"
MOCK_RUN_ID_2 = "8395c072-4724-4dae-9f4a-1407b25a2d5c"
MOCK_PROJECT = MockProject()
START_TIME = datetime.utcnow()
MOCK_RESULTS = [
    MockResult(
        id=MOCK_ID_1,
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


class TestWidgetController(BaseTestCase):
    """WidgetController integration test stubs"""

    @patch("ibutsu_server.widgets.compare_runs_view.Result.query")
    def test_get_comparison_result_list(self, mocked_query):
        """Test case for compare_runs_view.py::get_comparison_data

        Get the list of comparison results.
        """
        MOCK_RUN_IDS = [MOCK_RUN_ID_1, MOCK_RUN_ID_2]
        MOCKED_RESULTS = [[mocked_result] for mocked_result in MOCK_RESULTS]
        mocked_query = mocked_query.filter.return_value
        mocked_query.with_entities.return_value.order_by.return_value.first.side_effect = (
            MOCK_RUN_IDS
        )
        # TODO how to mock into the db.session.execute that's necessry for the query.scalers.all chain?
        mocked_query.filter.return_value.order_by.return_value.all.side_effect = MOCKED_RESULTS
        query_string = {
            "filters": ["metadata.component=frontend", "metadata.component=frontend"],
        }
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/widget/compare-runs-view",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        expected_response = {
            "pagination": {"totalItems": 1},
            "results": [MOCK_RESULTS_DICT],
        }
        assert response.json == expected_response
