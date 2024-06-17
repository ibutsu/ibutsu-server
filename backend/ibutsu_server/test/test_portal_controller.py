from unittest.mock import MagicMock, patch

from flask import json

from ibutsu_server.test import BaseTestCase, MockPortal, MockUser

MOCK_ID = "f40991a6-3305-11ef-9083-12b95372ee33"
MOCK_USER_ID = "0eea178e-3306-11ef-b969-12b95372ee33"

MOCK_PORTAL = MockPortal(
    id=MOCK_ID,
    name="unittest-portal",
    title="UnitTest Portal",
    owner_id=MOCK_USER_ID,
    default_dashboard_id="7e8a1684-3306-11ef-8433-12b95372ee33",
)
MOCK_USER = MockUser.from_dict(**{"id": MOCK_USER_ID})


class TestPortalController(BaseTestCase):
    """PortalController integration test stubs"""

    def setUp(self):
        """Set up a test data"""
        MOCK_PORTAL.owner = self.test_user
        self.session_patcher = patch("ibutsu_server.controllers.portal_controller.session")
        self.mock_session = self.session_patcher.start()

        mock_offset = MagicMock()
        mock_offset.limit.return_value.all.return_value = [MOCK_PORTAL]

        # mock portal return values for the DB query, and dict ctor
        self.portal_patcher = patch("ibutsu_server.controllers.portal_controller.Portal")
        self.mock_portal = self.portal_patcher.start()
        self.mock_portal.query.get.return_value = MOCK_PORTAL
        self.mock_portal.query.count.return_value = 1
        self.mock_portal.from_dict.return_value = MOCK_PORTAL

        # mock the offset for listing to return the only portal instance
        self.mock_portal.query.offset.return_value = mock_offset

    def tearDown(self):
        """Teardown the mocks"""
        self.portal_patcher.stop()
        self.session_patcher.stop()

    def test_add_portal(self):
        """Test case for add_portal

        Create a portal
        """
        self.user_patcher = patch("ibutsu_server.controllers.portal_controller.User")
        self.mock_user = self.user_patcher.start()
        self.mock_user.query.get.return_value = MOCK_USER
        # clear the setUp mock for the query since we're adding it here
        self.mock_portal.query.get.return_value = None

        response = self.client.open(
            "/api/portal",
            method="POST",
            headers=self.headers,
            data=json.dumps(MOCK_PORTAL.to_dict()),
            content_type="application/json",
        )
        self.assert_201(response)
        self.assert_equal(response.json, MOCK_PORTAL.to_dict())
        self.mock_session.add.assert_called_once_with(MOCK_PORTAL)
        self.mock_session.commit.assert_called_once()
        # teardown user patcher
        self.user_patcher.stop()

    def test_add_portal_409(self):
        """Test case to hit a conflict on add"""
        # MOCK_PORTAL is already there from setup, just try it again
        response = self.client.open(
            "/api/portal",
            method="POST",
            headers=self.headers,
            data=json.dumps(MOCK_PORTAL.to_dict()),
            content_type="application/json",
        )
        self.assert_409(response)

    def test_get_portal_by_id(self):
        """Test case for get_portal

        Get a single portal by ID
        """
        self.mock_portal.query.filter.return_value.first.return_value = None

        response = self.client.open(
            f"/api/portal/{MOCK_ID}", method="GET", headers=self.headers_no_content
        )
        self.assert_200(response)
        self.assert_equal(response.json, MOCK_PORTAL.to_dict())
        self.mock_portal.query.get.assert_called_once_with(MOCK_ID)

    def test_get_portal_by_name(self):
        """Test case for get_portal

        Get a single portal by name
        """
        self.mock_portal.query.filter.return_value.first.return_value = MOCK_PORTAL

        response = self.client.open(
            f"/api/portal/{MOCK_ID}", method="GET", headers=self.headers_no_content
        )
        self.assert_200(response)
        self.assert_equal(response.json, MOCK_PORTAL.to_dict())

    def test_get_portal_list(self):
        """Test case for get_portal_list

        Get a list of portals
        """
        query_string = [
            ("page", 56),
            ("pageSize", 56),
        ]

        response = self.client.open(
            "/api/portal", method="GET", headers=self.headers_no_content, query_string=query_string
        )
        self.assert_200(response)
        expected_response = {
            "pagination": {
                "page": 56,
                "pageSize": 56,
                "totalItems": 1,
                "totalPages": 1,
            },
            "portals": [MOCK_PORTAL.to_dict()],
        }
        assert response.json == expected_response

    def test_update_portal(self):
        """Test case for update_portal

        Update a portal
        """
        updates = {
            "owner_id": "dd338937-95f0-4b4e-a7a4-0d02da9f56e6",
        }
        updated_dict = MOCK_PORTAL.to_dict().copy()
        updated_dict.update(updates)

        response = self.client.open(
            f"/api/portal/{MOCK_ID}",
            method="PUT",
            headers=self.headers,
            data=json.dumps(updates),
            content_type="application/json",
        )
        self.assert_200(response)
        self.assert_equal(response.json, updated_dict)
