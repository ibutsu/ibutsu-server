def test_get_database_health(flask_app, auth_headers):
    """Test case for get_database_health
    Get a health report for the database
    """
    client, jwt_token = flask_app
    headers = auth_headers(jwt_token)
    response = client.open("/api/health/database", method="GET", headers=headers)
    assert response.status_code == 503, f"Response body is : {response.data.decode('utf-8')}"


def test_get_health(flask_app, auth_headers):
    """Test case for get_health
    Get a general health report
    """
    client, jwt_token = flask_app
    headers = auth_headers(jwt_token)
    response = client.open("/api/health", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
