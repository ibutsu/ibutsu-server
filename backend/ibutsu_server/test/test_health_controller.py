import unittest

from ibutsu_server.test import BaseTestCase


class TestHealthController(BaseTestCase):
    """HealthController integration test stubs"""

    def test_get_database_health(self):
        """Test case for get_database_health

        Get a health report for the database
        """
        response = self.client.open(
            "/api/health/database", method="GET", headers=self.headers_no_content
        )
        self.assert_503(response)

    def test_get_health(self):
        """Test case for get_health

        Get a general health report
        """
        response = self.client.open("/api/health", method="GET", headers=self.headers_no_content)
        self.assert_200(response)


if __name__ == "__main__":
    unittest.main()
