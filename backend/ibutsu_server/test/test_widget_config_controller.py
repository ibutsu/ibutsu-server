from unittest.mock import MagicMock, patch

from flask import json

from ibutsu_server.test import BaseTestCase, MockPortal, MockProject, MockWidgetConfig

MOCK_ID = "91e750be-2ef2-4d85-a50e-2c9366cefd9f"
MOCK_PROJECT_ID = "5ac7d645-45a3-4cbe-acb2-c8d6f7e05468"
MOCK_PORTAL_ID = "c2ae891a-33c6-11ef-b032-12b95372ee33"
MOCK_DASHBOARD_ID = "5af74747-3b75-4b00-afc3-6304c6f255d7"


MOCK_PORTAL = MockPortal.from_dict(
    id=MOCK_PORTAL_ID,
    name="unittest-portal",
    title="UnitTest Portal",
    owner_id="0eea178e-3306-11ef-b969-12b95372ee33",
    default_dashboard_id="7e8a1684-3306-11ef-8433-12b95372ee33",
)

MOCK_PROJECT = MockProject.from_dict(
    id=MOCK_PROJECT_ID,
    name="my-project",
    title="My Project",
    owner_id="8f22a434-b160-41ed-b700-0cc3d7f146b1",
    group_id="9af34437-047c-48a5-bd21-6430e4532414",
    users=[],
)

# missing project/portal, gets injected at subTest
MOCK_WIDGET_CONFIG = MockWidgetConfig(
    id=MOCK_ID,
    navigable=False,
    params={},
    title="Stage builds",
    type="widget",
    weight=0,
    widget="jenkins-heatmap",
    dashboard_id=MOCK_DASHBOARD_ID,
)

# create a complete config with project_id set
INTERIM = MOCK_WIDGET_CONFIG.to_dict()
INTERIM.update({"project_id": MOCK_PROJECT_ID})
MOCK_COMPLETE_WIDGET_CONFIG = MockWidgetConfig.from_dict(**INTERIM)


# create an updated config with default weight and a param added
INTERIM = MOCK_COMPLETE_WIDGET_CONFIG.to_dict()
INTERIM.update(
    {
        "params": {
            "jenkins_job_name": "stage",
        },  # value given to PUT call
        "weight": 10,  # default weight applied on update automatically
    }
)
MOCK_UPDATED_WIDGET_CONFIG = MockWidgetConfig.from_dict(**INTERIM)


VALID_PROJECT_PORTAL_COMBOS = [
    {"portal_id": MOCK_PORTAL_ID, "portal": None, "project_id": None, "project": None},
    {"portal_id": None, "portal": None, "project_id": MOCK_PROJECT_ID, "project": None},
    {"portal_id": None, "portal": MOCK_PORTAL.name, "project_id": None, "project": None},
    {"portal_id": None, "portal": None, "project_id": None, "project": MOCK_PROJECT.name},
]

# one of portal, portal_id, project, or project_id should be set
INVALID_WIDGET_CONFIG_COMBOS = [
    {
        "portal_id": MOCK_PORTAL_ID,
        "portal": None,
        "project_id": None,
        "project": {"dummy": "project"},  # the controller should raise before using this
    },
    {
        "portal_id": MOCK_PORTAL_ID,
        "portal": None,
        "project_id": MOCK_PROJECT_ID,
        "project": None,
    },
    {
        "portal_id": None,
        "portal": {"dummy": "portal"},  # the controller should raise before using this
        "project_id": MOCK_PROJECT_ID,
        "project": None,
    },
    {
        "portal_id": None,
        "portal": {"dummy": "portal"},  # the controller should raise before using this,
        "project_id": None,
        "project": {"dummy": "project"},  # the controller should raise before using this
    },
    {"portal_id": None, "portal": None, "project_id": None, "project": None},
    {"portal_id": MOCK_PORTAL_ID, "widget": "junk-widget-type"},
]


class TestWidgetConfigController(BaseTestCase):
    """WidgetConfigController integration test stubs"""

    def setUp(self):
        """Set up tests"""
        # mock the db session
        self.session_patcher = patch("ibutsu_server.controllers.widget_config_controller.session")
        self.mock_session = self.session_patcher.start()
        # mock the project_has_user return
        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True
        # mock the WidgetConfig class
        self.widget_config_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.WidgetConfig"
        )
        self.mock_widget_config = self.widget_config_patcher.start()
        # mock the get_portal response
        self.get_portal_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.get_portal"
        )
        self.mock_get_portal = self.get_portal_patcher.start()
        # mock the get_project response
        self.get_project_patcher = patch(
            "ibutsu_server.controllers.widget_config_controller.get_project"
        )
        self.mock_get_project = self.get_project_patcher.start()

    def tearDown(self):
        """Teardown the mocks"""
        self.widget_config_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def mock_widget_config_returns(
        self, config_dict=None, from_dict_obj=None, portal=None, project=None
    ):
        self.mock_widget_config.return_value = config_dict or MOCK_COMPLETE_WIDGET_CONFIG.to_dict()
        self.mock_widget_config.query.get.return_value = (
            from_dict_obj or MOCK_COMPLETE_WIDGET_CONFIG
        )
        self.mock_widget_config.from_dict.return_value = (
            from_dict_obj or MOCK_COMPLETE_WIDGET_CONFIG
        )
        self.mock_get_portal.return_value = portal
        self.mock_get_project.return_value = project

    def test_add_widget_config(self):
        """Test case for add_widget_config

        Create a test widget_config
        """

        for config in VALID_PROJECT_PORTAL_COMBOS:
            widget_config_dict = MOCK_COMPLETE_WIDGET_CONFIG.to_dict()
            with self.subTest(config=config):
                # overwrite project/portal/project_id/portal_id with subtest config
                widget_config_dict.update(config)
                # run the updated dict through from_dict.to_dict and mock the return to None
                MOCK_WC_WITH_PROJECT_PORTAL = MockWidgetConfig.from_dict(**widget_config_dict)
                # Figure out whether to patch the get_portal or get_project function
                PORTAL_OR_PROJ = {}
                if config.get("portal") is not None:
                    PORTAL_OR_PROJ = {"portal": MOCK_PORTAL}
                if config.get("project") is not None:
                    PORTAL_OR_PROJ = {"project": MOCK_PROJECT}
                # Inject the mock return values based on subTest config
                self.mock_widget_config_returns(
                    MOCK_WC_WITH_PROJECT_PORTAL.to_dict(),
                    MOCK_WC_WITH_PROJECT_PORTAL,
                    **PORTAL_OR_PROJ,
                )
                self.mock_widget_config.query.get.return_value = None

                response = self.client.open(
                    "/api/widget-config",
                    method="POST",
                    headers=self.headers,
                    data=json.dumps(widget_config_dict),
                    content_type="application/json",
                )
                self.assert_201(response)
                assert response.json == MOCK_WC_WITH_PROJECT_PORTAL.to_dict()
            widget_config_dict = MOCK_COMPLETE_WIDGET_CONFIG.to_dict()

    # TODO: test 403 on add

    def test_add_widget_invalid_config_bad_request(self):
        """Test case for adding invalid widget config to produce BAD REQUEST

        Should not create a WC
        """

        for config in INVALID_WIDGET_CONFIG_COMBOS:
            # use the incomplete mock to inject project/portal/ids
            widget_config_dict = MOCK_WIDGET_CONFIG.to_dict()

            with self.subTest(config=config):
                widget_config_dict.update(config)
                MOCK_WIDGET_CONFIG_FULL = MockWidgetConfig.from_dict(**widget_config_dict)
                self.mock_widget_config_returns(
                    MOCK_WIDGET_CONFIG_FULL.to_dict(),
                    MOCK_WIDGET_CONFIG_FULL,
                )
                self.mock_widget_config.query.get.return_value = None

                response = self.client.open(
                    "/api/widget-config",
                    method="POST",
                    headers=self.headers,
                    data=json.dumps(widget_config_dict),
                    content_type="application/json",
                )

                self.assert_400(response)

    def test_get_widget_config(self):
        """Test case for get_widget_config

        Get a single widget_config
        """
        # mock in the full config for an existing widget_config
        self.mock_widget_config_returns()

        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}", method="GET", headers=self.headers_no_content
        )
        self.assert_200(response)
        assert response.json == MOCK_COMPLETE_WIDGET_CONFIG.to_dict()

    def test_get_widget_config_404(self):
        """Test case for get_widget_config

        Return a 404 when no widget config is found
        """
        # mock in the full config for an existing widget_config
        self.mock_widget_config_returns()
        self.mock_widget_config.query.get.return_value = None  # override query to trigger 404

        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}", method="GET", headers=self.headers_no_content
        )
        self.assert_404(response)

    def test_get_widget_config_list(self):
        """Test case for get_widget_config_list

        Get the list of widget_configs.
        """
        mock_all = MagicMock(return_value=[MOCK_WIDGET_CONFIG])
        mock_query = self.mock_widget_config.query
        mock_query.order_by.return_value.offset.return_value.limit.return_value.all = mock_all
        mock_query.count.return_value = 1

        response = self.client.open(
            "/api/widget-config", method="GET", headers=self.headers_no_content
        )
        self.assert_200(response)
        expected_response = {
            "pagination": {"page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1},
            "widgets": [MOCK_WIDGET_CONFIG.to_dict()],
        }
        assert response.json == expected_response

    def test_update_widget_config(self):
        """Test case for update_widget_config

        Updates a single widget_config
        TODO: expand for testing project/portal fetch. same pattern as the add_widget_config controller
        TODO: cover navigable + type logic in the update controller
        """
        widget_config_update = {
            "params": {
                "jenkins_job_name": "stage",
            },
        }
        # mock in the full config for an existing widget_config
        self.mock_widget_config_returns()

        # try to update params, weight should also automatically move from 0 to 10
        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}",
            method="PUT",
            headers=self.headers,
            data=json.dumps(widget_config_update),
            content_type="application/json",
        )
        self.assert_200(response)
        assert response.json == MOCK_UPDATED_WIDGET_CONFIG.to_dict()

    # TODO: test 403 on update

    def test_update_widget_invalid_config_bad_request(self):
        """Test case for updating invalid widget config to produce BAD REQUEST

        Should not update the target WC
        """

        # mock in the full config for an existing widget_config
        self.mock_widget_config_returns()

        for config in INVALID_WIDGET_CONFIG_COMBOS:
            with self.subTest(config=config):
                # reset widget config on each subtest
                widget_config_dict = MOCK_WIDGET_CONFIG.to_dict()
                widget_config_dict.update(config)
                # reset mocks on subtest
                self.mock_widget_config_returns()
                self.mock_widget_config.query.get.return_value = None

                response = self.client.open(
                    "/api/widget-config/{MOCK_ID}",
                    method="PUT",
                    headers=self.headers,
                    data=json.dumps(widget_config_dict),
                    content_type="application/json",
                )

                self.assert_400(response)

    def test_delete_widget_config(self):
        """Test the deletion of widget configs"""

        # mock in the full config for an existing widget_config
        self.mock_widget_config_returns()

        response = self.client.open(
            f"/api/widget-config/{MOCK_ID}",
            method="DELETE",
            headers=self.headers,
        )
        self.assert_200(response)

    # TODO: test 403 on delete

    def test_delete_widget_config_404(self):
        """Test that trying to delete a non-existant widget_config throws a 404"""
        self.mock_widget_config.query.get.return_value = None

        response = self.client.open(
            "/api/widget-config/{id}".format(id="885021da-4a73-4110-9024-eff12b66ce19"),
            method="DELETE",
            headers=self.headers,
        )
        self.assert_404(response)
