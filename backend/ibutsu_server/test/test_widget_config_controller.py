from unittest.mock import MagicMock, patch

from flask import json

from ibutsu_server.test import BaseTestCase, MockWidgetConfig

# from ibutsu_server.test import MockDashboard
# from ibutsu_server.test import MockProject

MOCK_ID = "91e750be-2ef2-4d85-a50e-2c9366cefd9f"
MOCK_PROJECT_ID = "5ac7d645-45a3-4cbe-acb2-c8d6f7e05468"
MOCK_DASHBOARD_ID = "5af74747-3b75-4b00-afc3-6304c6f255d7"
MOCK_WIDGET_CONFIG = MockWidgetConfig(
    id=MOCK_ID,
    navigable=False,
    params={},
    title="Stage builds",
    type="widget",
    weight=0,
    widget="jenkins-heatmap",
    project_id=MOCK_PROJECT_ID,
    dashboard_id=MOCK_DASHBOARD_ID,
)
MOCK_WIDGET_CONFIG_DICT = MOCK_WIDGET_CONFIG.to_dict()
# the result to be POST'ed to Ibutsu, we expect it to transformed into MOCK_RESULT
ADDED_WIDGET_CONFIG = MockWidgetConfig(
    id=MOCK_ID,
    navigable=False,
    params={},
    title="Stage builds",
    type="widget",
    weight=0,
    widget="jenkins-heatmap",
    project_id=MOCK_PROJECT_ID,
    dashboard_id=MOCK_DASHBOARD_ID,
)
UPDATED_WIDGET_CONFIG = MockWidgetConfig(
    id=MOCK_ID,
    navigable=False,
    params={"jenkins_job_name": "stage"},
    title="Stage builds",
    type="widget",
    weight=10,
    widget="jenkins-heatmap",
    project_id=MOCK_PROJECT_ID,
    dashboard_id=MOCK_DASHBOARD_ID,
)


class TestWidgetConfigController(BaseTestCase):
    """WidgetConfigController integration test stubs"""

    def setUp(self):
        """Set up tests"""
        self.session_patcher = patch("ibutsu_server.controllers.widget_config_controller.session")
        self.mock_session = self.session_patcher.start()
        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True
        self.widget_config_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.WidgetConfig"
        )
        self.mock_widget_config = self.widget_config_patcher.start()
        self.mock_widget_config.return_value = MOCK_WIDGET_CONFIG
        self.mock_widget_config.query.get.return_value = MOCK_WIDGET_CONFIG
        self.mock_widget_config.from_dict.return_value = ADDED_WIDGET_CONFIG

    def tearDown(self):
        """Teardown the mocks"""
        self.widget_config_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def test_add_widget_config(self):
        """Test case for add_widget_config

        Create a test widget_config
        """
        widget_config = ADDED_WIDGET_CONFIG.to_dict()
        self.mock_widget_config.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/widget-config",
            method="POST",
            headers=headers,
            data=json.dumps(widget_config),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_WIDGET_CONFIG_DICT

    def test_get_widget_config(self):
        """Test case for get_widget_config

        Get a single widget_config
        """
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(f"/api/widget-config/{MOCK_ID}", method="GET", headers=headers)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_WIDGET_CONFIG_DICT

    def test_get_widget_config_404(self):
        """Test case for get_widget_config

        Return a 404 when no widget config is found
        """
        self.mock_widget_config.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(f"/api/widget-config/{MOCK_ID}", method="GET", headers=headers)
        self.assert_404(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_widget_config_list(self):
        """Test case for get_widget_config_list

        Get the list of widget_configs.
        """
        mock_all = MagicMock(return_value=[MOCK_WIDGET_CONFIG])
        # TODO how to mock into the db.session.execute that's necessry for the query.scalers.all chain?
        mock_query = self.mock_widget_config.query

        mock_query.order_by.return_value.offset.return_value.limit.return_value.all = mock_all
        mock_query.count.return_value = 1
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open("/api/widget-config", method="GET", headers=headers)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        expected_response = {
            "pagination": {"page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1},
            "widgets": [MOCK_WIDGET_CONFIG_DICT],
        }
        assert response.json == expected_response

    def test_update_widget_config(self):
        """Test case for update_widget_config

        Updates a single widget_config
        """
        widget_config = {
            "params": {
                "jenkins_job_name": "stage",
            },
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(widget_config),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == UPDATED_WIDGET_CONFIG.to_dict()

    def test_delete_widget_config(self):
        """Test the deletion of widget configs"""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}",
            method="DELETE",
            headers=headers,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_delete_widget_config_404(self):
        """Test that trying to delete a non-existant widget_config throws a 404"""
        self.mock_widget_config.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/widget-config/{id}".format(id="885021da-4a73-4110-9024-eff12b66ce19"),
            method="DELETE",
            headers=headers,
        )
        self.assert_404(response, "Response body is : " + response.data.decode("utf-8"))
