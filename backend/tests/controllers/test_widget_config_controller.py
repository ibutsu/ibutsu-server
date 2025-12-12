from uuid import uuid4

import pytest

from ibutsu_server.db import db
from ibutsu_server.db.models import WidgetConfig


def test_get_widget_config_list(flask_app, make_project, make_widget_config, auth_headers):
    """Test get_widget_config_list"""
    client, jwt_token = flask_app

    # Create project and widget configs
    project = make_project(name="test-project")

    for i in range(5):
        make_widget_config(
            project_id=project.id, widget=f"widget-{i}", params={"config_key": f"value{i}"}
        )

    headers = auth_headers(jwt_token)

    response = client.get(f"/api/widget-config?project_id={project.id}", headers=headers)

    assert response.status_code == 200
    json_response = response.json()
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
    flask_app, make_project, make_widget_config, page, page_size, auth_headers
):
    """Test get_widget_config_list with pagination"""
    client, jwt_token = flask_app

    # Create project and widget configs
    project = make_project(name="test-project")

    for i in range(30):
        make_widget_config(project_id=project.id, widget=f"widget-{i}")

    headers = auth_headers(jwt_token)

    query_string = [("project_id", str(project.id)), ("page", page), ("pageSize", page_size)]
    response = client.get("/api/widget-config", headers=headers, params=query_string)

    assert response.status_code == 200
    json_response = response.json()
    assert "widgets" in json_response
    assert "pagination" in json_response
    assert json_response["pagination"]["page"] == page
    assert json_response["pagination"]["pageSize"] == page_size


def test_add_widget_config(flask_app, make_project, auth_headers):
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

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["widget"] == "run-aggregator"
    assert response_data["title"] == "My Widget"

    # Verify in database
    with client.application.app_context():
        widget = WidgetConfig.query.filter_by(widget="run-aggregator").first()
        assert widget is not None
        assert widget.title == "My Widget"


def test_get_widget_config(flask_app, make_project, make_widget_config, auth_headers):
    """Test get_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget", title="Test Widget")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/widget-config/{widget.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(widget.id)
    assert response_data["widget"] == "test-widget"


def test_update_widget_config(flask_app, make_project, make_widget_config, auth_headers):
    """Test update_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget", title="Original Title")

    update_data = {
        "title": "Updated Title",
        "params": {"new_key": "new_value"},
    }

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/widget-config/{widget.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        updated_widget = db.session.get(WidgetConfig, str(widget.id))
        assert updated_widget.title == "Updated Title"


def test_delete_widget_config(flask_app, make_project, make_widget_config, auth_headers):
    """Test delete_widget_config"""
    client, jwt_token = flask_app

    # Create widget config
    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="test-widget")
    widget_id = widget.id

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/widget-config/{widget_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify widget config was deleted
    with client.application.app_context():
        deleted_widget = db.session.get(WidgetConfig, str(widget_id))
        assert deleted_widget is None


def test_delete_widget_config_not_found(flask_app, auth_headers):
    """Test delete_widget_config - widget config not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.delete(
        "/api/widget-config/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_add_widget_config_invalid_widget_type(flask_app, make_project, auth_headers):
    """Test add_widget_config with invalid widget type"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    widget_config_data = {
        "widget": "invalid-widget-type",
        "project_id": str(project.id),
        "params": {},
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 400
    assert "widget type does not exist" in response.text.lower()


def test_add_widget_config_with_project_name(flask_app, make_project, auth_headers):
    """Test add_widget_config using project name instead of ID"""
    client, jwt_token = flask_app

    project = make_project(name="my-test-project")

    widget_config_data = {
        "widget": "run-aggregator",
        "project": "my-test-project",  # Use project name
        "params": {"weeks": 4},
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["project_id"] == str(project.id)


def test_add_widget_config_default_weight(flask_app, make_project, auth_headers):
    """Test add_widget_config sets default weight"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    widget_config_data = {
        "widget": "run-aggregator",
        "project_id": str(project.id),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    assert response_data["weight"] == 10  # Default weight


@pytest.mark.parametrize(
    ("widget_type", "navigable_value", "expected_navigable"),
    [
        ("view", None, True),  # View with no navigable should default to True
        ("view", "true", True),  # String "true" should be converted
        ("view", "t", True),  # String "t" should be converted
        ("view", "1", True),  # String "1" should be converted
        ("widget", None, None),  # Widget type shouldn't set navigable
    ],
)
def test_add_widget_config_navigable_handling(
    flask_app, make_project, auth_headers, widget_type, navigable_value, expected_navigable
):
    """Test add_widget_config navigable field handling for views"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    widget_config_data = {
        "widget": "run-aggregator",
        "type": widget_type,
        "project_id": str(project.id),
    }

    if navigable_value is not None:
        widget_config_data["navigable"] = navigable_value

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    if expected_navigable is not None:
        assert response_data.get("navigable") == expected_navigable


def test_add_widget_config_cleans_invalid_params(flask_app, make_project, auth_headers):
    """Test add_widget_config validates and cleans widget parameters"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    # run-aggregator has specific allowed params, send invalid ones
    widget_config_data = {
        "widget": "run-aggregator",
        "project_id": str(project.id),
        "params": {
            "weeks": 4,  # Valid param
            "invalid_param": "should_be_removed",  # Invalid param
            "another_invalid": 123,  # Invalid param
        },
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/widget-config",
        headers=headers,
        json=widget_config_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    # Verify invalid params were cleaned out, only valid params remain
    assert "weeks" in response_data["params"]
    assert "invalid_param" not in response_data["params"]
    assert "another_invalid" not in response_data["params"]


def test_get_widget_config_not_found(flask_app, auth_headers):
    """Test get_widget_config - widget config not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/widget-config/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_update_widget_config_invalid_widget_type(
    flask_app, make_project, make_widget_config, auth_headers
):
    """Test update_widget_config with invalid widget type"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="run-aggregator")

    update_data = {
        "widget": "invalid-widget-type",
    }

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/widget-config/{widget.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 400
    assert "widget type does not exist" in response.text.lower()


def test_update_widget_config_not_found(flask_app, auth_headers):
    """Test update_widget_config - widget config not found"""
    client, jwt_token = flask_app

    update_data = {"title": "New Title"}

    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/widget-config/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 404


def test_update_widget_config_cleans_invalid_params(
    flask_app, make_project, make_widget_config, auth_headers
):
    """Test update_widget_config validates and cleans widget parameters"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")
    widget = make_widget_config(project_id=project.id, widget="run-aggregator", params={"weeks": 4})

    update_data = {
        "params": {
            "weeks": 8,  # Valid param
            "invalid_param": "should_be_removed",  # Invalid param
        }
    }

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/widget-config/{widget.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200

    response_data = response.json()
    # Verify invalid params were cleaned out, only valid params remain
    assert response_data["params"]["weeks"] == 8
    assert "invalid_param" not in response_data["params"]


@pytest.mark.parametrize(
    ("filter_string", "expected_match_count"),
    [
        (
            "widget=run-aggregator",
            lambda widgets: sum(1 for w in widgets if w["widget"] == "run-aggregator"),
        ),
        ("type=widget", lambda widgets: sum(1 for w in widgets if w.get("type") == "widget")),
    ],
)
def test_get_widget_config_list_with_filters(
    flask_app, make_project, make_widget_config, auth_headers, filter_string, expected_match_count
):
    """Test get_widget_config_list with various filters"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    # Create different widget types
    make_widget_config(project_id=project.id, widget="run-aggregator", type="widget")
    make_widget_config(project_id=project.id, widget="result-summary", type="widget")
    make_widget_config(project_id=project.id, widget="jenkins-heatmap", type="widget")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/widget-config?filter={filter_string}",
        headers=headers,
    )
    assert response.status_code == 200

    response_data = response.json()
    widgets = response_data["widgets"]
    # Verify filter worked by checking match count
    matches = expected_match_count(widgets)
    assert matches > 0


@pytest.mark.parametrize(
    ("widget_id", "expected_status"),
    [
        ("not-a-uuid", 400),
        ("invalid-format", 400),
    ],
)
def test_widget_config_operations_invalid_uuid(flask_app, auth_headers, widget_id, expected_status):
    """Test widget config operations with invalid UUID formats"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)

    # Test get
    response = client.get(f"/api/widget-config/{widget_id}", headers=headers)
    assert response.status_code == expected_status

    # Test update
    response = client.put(
        f"/api/widget-config/{widget_id}",
        headers=headers,
        json={"title": "New Title"},
    )
    assert response.status_code == expected_status

    # Test delete
    response = client.delete(f"/api/widget-config/{widget_id}", headers=headers)
    assert response.status_code == expected_status


def test_get_widget_config_cleans_invalid_params_on_retrieval(
    flask_app, make_project, make_widget_config, auth_headers
):
    """Test get_widget_config cleans invalid params when retrieving"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    # Directly create a widget with invalid params (bypassing validation)
    with client.application.app_context():
        widget = WidgetConfig(
            id=str(uuid4()),
            widget="run-aggregator",
            project_id=project.id,
            params={"weeks": 4, "invalid_param": "bad"},  # Include invalid param
        )
        db.session.add(widget)
        db.session.commit()
        db.session.refresh(widget)
        widget_id = widget.id

    # Retrieve the widget - should clean params
    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/widget-config/{widget_id}",
        headers=headers,
    )
    assert response.status_code == 200

    response_data = response.json()
    # Verify invalid param was cleaned out during retrieval
    assert "weeks" in response_data["params"]
    assert "invalid_param" not in response_data["params"]
