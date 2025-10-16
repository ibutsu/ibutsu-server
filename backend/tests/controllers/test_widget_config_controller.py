import pytest
from flask import json


def test_get_widget_config_list(flask_app, make_project, make_widget_config):
    """Test get_widget_config_list"""
    client, jwt_token = flask_app

    # Create project and widget configs
    project = make_project(name="test-project")

    for i in range(5):
        make_widget_config(
            project_id=project.id, widget=f"widget-{i}", params={"config_key": f"value{i}"}
        )

    headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

    response = client.get(f"/api/widget-config?project_id={project.id}", headers=headers)

    assert response.status_code == 200
    json_response = response.json
    # Response should have pagination structure
    assert "widgets" in json_response
    assert "pagination" in json_response
    assert len(json_response["widgets"]) == 5


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 50),
    ],
)
def test_get_widget_config_list_pagination(
    flask_app, make_project, make_widget_config, page, page_size
):
    """Test get_widget_config_list with pagination"""
    client, jwt_token = flask_app

    # Create project and widget configs
    project = make_project(name="test-project")

    for i in range(30):
        make_widget_config(project_id=project.id, widget=f"widget-{i}")

    headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

    query_string = [("project_id", str(project.id)), ("page", page), ("pageSize", page_size)]
    response = client.get("/api/widget-config", headers=headers, query_string=query_string)

    assert response.status_code == 200
    json_response = response.json
    assert "widgets" in json_response
    assert "pagination" in json_response
    assert json_response["pagination"]["page"] == page
    assert json_response["pagination"]["pageSize"] == page_size


def test_add_widget_config(flask_app, make_project):
    """Test add_widget_config"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    widget_config_data = {
        "widget": "run-aggregator",  # Use a valid widget type
        "project_id": str(project.id),
        "params": {},
        "title": "My Widget",
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/widget-config",
        headers=headers,
        data=json.dumps(widget_config_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["widget"] == "run-aggregator"
    assert response_data["title"] == "My Widget"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import WidgetConfig

        widget = WidgetConfig.query.filter_by(widget="run-aggregator").first()
        assert widget is not None
        assert widget.title == "My Widget"


def test_get_widget_config(flask_app, make_project, make_widget_config):
    """Test get_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget", title="Test Widget")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/widget-config/{widget.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["id"] == str(widget.id)
    assert response_data["widget"] == "test-widget"


def test_update_widget_config(flask_app, make_project, make_widget_config):
    """Test update_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget", title="Original Title")

    update_data = {
        "title": "Updated Title",
        "params": {"new_key": "new_value"},
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/widget-config/{widget.id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import WidgetConfig

        updated_widget = WidgetConfig.query.get(str(widget.id))
        assert updated_widget.title == "Updated Title"


def test_delete_widget_config(flask_app, make_project, make_widget_config):
    """Test delete_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget")
    widget_id = widget.id

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        f"/api/widget-config/{widget_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify widget config was deleted
    with client.application.app_context():
        from ibutsu_server.db.models import WidgetConfig

        deleted_widget = WidgetConfig.query.get(str(widget_id))
        assert deleted_widget is None


def test_delete_widget_config_not_found(flask_app):
    """Test delete_widget_config - widget config not found"""
    client, jwt_token = flask_app

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        "/api/widget-config/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404
