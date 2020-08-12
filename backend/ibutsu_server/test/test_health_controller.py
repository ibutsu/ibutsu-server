# coding: utf-8
from __future__ import absolute_import

import unittest
from unittest.mock import patch

from ibutsu_server.test import BaseTestCase


class TestHealthController(BaseTestCase):
    """HealthController integration test stubs"""

    def test_get_database_health(self):
        """Test case for get_database_health

        Get a health report for the database
        """
        with patch("ibutsu_server.controllers.health_controller.Result"):
            headers = {"Accept": "application/json"}
            response = self.client.open("/api/health/database", method="GET", headers=headers)
            self.assert200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_health(self):
        """Test case for get_health

        Get a general health report
        """
        headers = {"Accept": "application/json"}
        response = self.client.open("/api/health", method="GET", headers=headers)
        self.assert200(response, "Response body is : " + response.data.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
