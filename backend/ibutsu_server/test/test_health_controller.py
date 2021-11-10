# coding: utf-8
from __future__ import absolute_import

import unittest

from ibutsu_server.test import BaseTestCase


class TestHealthController(BaseTestCase):
    """HealthController integration test stubs"""

    def test_get_database_health(self):
        """Test case for get_database_health

        Get a health report for the database
        """
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open("/api/health/database", method="GET", headers=headers)
        self.assert_500(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_health(self):
        """Test case for get_health

        Get a general health report
        """
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open("/api/health", method="GET", headers=headers)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
