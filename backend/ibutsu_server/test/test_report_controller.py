from unittest.mock import MagicMock
from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockReport

MOCK_ID = "751162a7-b0e0-448e-9af3-676d1a48b0ca"
MOCK_PARAMS = {"type": "csv", "source": "local"}
MOCK_DATA = {
    "id": MOCK_ID,
    "filename": "report.csv",
    "mimetype": "text/csv",
    "url": "",
    "params": MOCK_PARAMS,
    "created": "2019-09-30T22:08:30.205319",
}
MOCK_REPORT = MockReport.from_dict(**MOCK_DATA)
MOCK_REPORT_DICT = MOCK_REPORT.to_dict()
MOCK_CSV = {"func": MagicMock()}


class TestReportController(BaseTestCase):
    """ReportController integration test stubs"""

    def setUp(self):
        """Set up some mocked objects"""
        self.session_patcher = patch("ibutsu_server.controllers.report_controller.session")
        self.mock_session = self.session_patcher.start()
        self.report_patcher = patch("ibutsu_server.controllers.report_controller.Report")
        self.mock_report = self.report_patcher.start()
        self.mock_report.return_value = MOCK_REPORT
        self.mock_report.from_dict.return_value = MOCK_REPORT
        self.mock_report.query.get.return_value = MOCK_REPORT

    def tearDown(self):
        """Tear down mocks"""
        self.report_patcher.stop()
        self.session_patcher.stop()

    def test_add_report(self):
        """Test case for add_report

        Create a new report
        """
        body = {"type": "csv", "source": "local"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        with patch.dict("ibutsu_server.controllers.report_controller.REPORTS", {"csv": MOCK_CSV}):
            response = self.client.open(
                "/api/report",
                method="POST",
                headers=headers,
                data=json.dumps(body),
                content_type="application/json",
            )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_REPORT_DICT

    def test_get_report(self):
        """Test case for get_report

        Get a report
        """
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/report/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_REPORT_DICT

    def test_get_report_list(self):
        """Test case for get_report_list

        Get a list of reports
        """
        self.mock_report.query.count.return_value = 1
        mock_limit = MagicMock()
        mock_limit.return_value.all.return_value = [MOCK_REPORT]
        self.mock_report.query.order_by.return_value.offset.return_value.limit = mock_limit
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        with patch(
            "ibutsu_server.controllers.report_controller.get_project_id"
        ) as mocked_get_project_id:
            mocked_get_project_id.return_value = None
            response = self.client.open(
                "/api/report", method="GET", headers=headers, query_string=query_string
            )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        expected_response = {
            "pagination": {"page": 56, "pageSize": 56, "totalItems": 1, "totalPages": 1},
            "reports": [MOCK_REPORT_DICT],
        }
        assert response.json == expected_response
