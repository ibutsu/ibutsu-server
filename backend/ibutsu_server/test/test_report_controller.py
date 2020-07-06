# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from flask import json
from ibutsu_server.test import BaseTestCase

MOCK_ID = "cd7994f77bcf8639011507f1"
MOCK_PARAMS = {"type": "csv", "source": "local"}
MOCK_REPORT = {
    "_id": ObjectId(MOCK_ID),
    "id": MOCK_ID,
    "filename": "report.csv",
    "mimetype": "text/csv",
    "url": "",
    "parameters": MOCK_PARAMS,
    "created": "2019-09-30T22:08:30.205319",
}
MOCK_CSV = {"func": MagicMock()}


class TestReportController(BaseTestCase):
    """ReportController integration test stubs"""

    def setUp(self):
        """Set up some mocked objects"""
        self.mongo_patcher = patch("ibutsu_server.controllers.report_controller.mongo")
        self.mocked_mongo = self.mongo_patcher.start()
        self.mocked_mongo.reports.count.return_value = 1
        self.mocked_mongo.reports.find_one.return_value = MOCK_REPORT
        self.mocked_mongo.reports.find.return_value = [MOCK_REPORT]

    def tearDown(self):
        """Tear down mocks"""
        self.mongo_patcher.stop()

    def test_add_report(self):
        """Test case for add_report

        Create a new report
        """
        body = {"type": "csv", "source": "local"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        with patch.dict("ibutsu_server.controllers.report_controller.REPORTS", {"csv": MOCK_CSV}):
            response = self.client.open(
                "/api/report",
                method="POST",
                headers=headers,
                data=json.dumps(body),
                content_type="application/json",
            )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_report(self):
        """Test case for get_report

        Get a report
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/report/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_report_list(self):
        """Test case for get_report_list

        Get a list of reports
        """
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/report", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
