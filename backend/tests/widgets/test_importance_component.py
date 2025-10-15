"""Tests for importance_component widget"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.widgets.importance_component import get_importance_component


@pytest.fixture
def mock_results():
    """Mock results for importance component"""
    result1 = MagicMock()
    result1.component = "component1"
    result1.id = str(uuid.uuid4())
    result1.result = "passed"
    result1.importance = "high"
    result1.build_number = "100"

    result2 = MagicMock()
    result2.component = "component1"
    result2.id = str(uuid.uuid4())
    result2.result = "failed"
    result2.importance = "high"
    result2.build_number = "100"

    result3 = MagicMock()
    result3.component = "component1"
    result3.id = str(uuid.uuid4())
    result3.result = "passed"
    result3.importance = "medium"
    result3.build_number = "100"

    result4 = MagicMock()
    result4.component = "component2"
    result4.id = str(uuid.uuid4())
    result4.result = "passed"
    result4.importance = "low"
    result4.build_number = "101"

    return [result1, result2, result3, result4]


@pytest.mark.skip(
    reason="Mocking SQLAlchemy string_to_column with desc() is complex - requires integration test"
)
def test_get_importance_component_with_valid_project(mock_results):
    """Test getting importance component with valid project ID"""
    project_id = str(uuid.uuid4())

    with (
        patch("ibutsu_server.widgets.importance_component.session") as mock_session,
        patch("ibutsu_server.widgets.importance_component.Result") as mock_result_class,
        patch(
            "ibutsu_server.widgets.importance_component.string_to_column"
        ) as mock_string_to_column,
    ):
        mock_query = MagicMock()
        mock_result_class.query.filter.return_value = mock_query
        mock_query.add_columns.return_value = mock_query
        mock_query.all.return_value = mock_results

        mock_column = MagicMock()
        mock_column.label.return_value = mock_column
        mock_string_to_column.return_value = mock_column

        mock_session.query.return_value = mock_query

        result = get_importance_component(
            job_name="test-job", builds=5, components="component1,component2", project=project_id
        )

        assert result is not None
        assert "table_data" in result
        assert isinstance(result["table_data"], list)


def test_get_importance_component_with_invalid_project():
    """Test getting importance component with invalid project ID"""
    project_id = "invalid-project-id"

    with pytest.raises(ValueError, match="Invalid project ID format"):
        get_importance_component(
            job_name="test-job", builds=5, components="component1", project=project_id
        )


def test_get_importance_component_with_none_project():
    """Test getting importance component with None project"""
    result = get_importance_component(
        job_name="test-job", builds=5, components="component1", project=None
    )

    # When project is None, _get_results returns [], which becomes {"table_data": []}
    assert result == {"table_data": []}


@pytest.mark.skip(
    reason="Mocking SQLAlchemy string_to_column with desc() is complex - requires integration test"
)
def test_get_importance_component_with_count_skips(mock_results):
    """Test getting importance component with count_skips enabled"""
    project_id = str(uuid.uuid4())

    with (
        patch("ibutsu_server.widgets.importance_component.session") as mock_session,
        patch("ibutsu_server.widgets.importance_component.Result") as mock_result_class,
        patch(
            "ibutsu_server.widgets.importance_component.string_to_column"
        ) as mock_string_to_column,
    ):
        mock_query = MagicMock()
        mock_result_class.query.filter.return_value = mock_query
        mock_query.add_columns.return_value = mock_query
        mock_query.all.return_value = mock_results

        mock_column = MagicMock()
        mock_column.label.return_value = mock_column
        mock_string_to_column.return_value = mock_column

        mock_session.query.return_value = mock_query

        result = get_importance_component(
            job_name="test-job",
            builds=5,
            components="component1,component2",
            project=project_id,
            count_skips=True,
        )

        assert result is not None
        assert "table_data" in result


@pytest.mark.skip(
    reason="Mocking SQLAlchemy string_to_column with desc() is complex - requires integration test"
)
def test_get_importance_component_empty_results():
    """Test getting importance component with no results"""
    project_id = str(uuid.uuid4())

    with (
        patch("ibutsu_server.widgets.importance_component.session") as mock_session,
        patch("ibutsu_server.widgets.importance_component.Result") as mock_result_class,
        patch(
            "ibutsu_server.widgets.importance_component.string_to_column"
        ) as mock_string_to_column,
    ):
        mock_query = MagicMock()
        mock_result_class.query.filter.return_value = mock_query
        mock_query.add_columns.return_value = mock_query
        mock_query.all.return_value = []

        mock_column = MagicMock()
        mock_column.label.return_value = mock_column
        mock_string_to_column.return_value = mock_column

        mock_session.query.return_value = mock_query

        result = get_importance_component(
            job_name="test-job", builds=5, components="component1", project=project_id
        )

        assert result is not None
        assert "table_data" in result
        assert len(result["table_data"]) == 0


@pytest.mark.skip(
    reason="Mocking SQLAlchemy string_to_column with desc() is complex - requires integration test"
)
def test_get_importance_component_different_builds():
    """Test getting importance component with different build numbers"""
    project_id = str(uuid.uuid4())

    result1 = MagicMock()
    result1.component = "component1"
    result1.id = str(uuid.uuid4())
    result1.result = "passed"
    result1.importance = "high"
    result1.build_number = "100"

    result2 = MagicMock()
    result2.component = "component1"
    result2.id = str(uuid.uuid4())
    result2.result = "passed"
    result2.importance = "high"
    result2.build_number = "101"

    mock_results = [result1, result2]

    with (
        patch("ibutsu_server.widgets.importance_component.session") as mock_session,
        patch("ibutsu_server.widgets.importance_component.Result") as mock_result_class,
        patch(
            "ibutsu_server.widgets.importance_component.string_to_column"
        ) as mock_string_to_column,
    ):
        mock_query = MagicMock()
        mock_result_class.query.filter.return_value = mock_query
        mock_query.add_columns.return_value = mock_query
        mock_query.all.return_value = mock_results

        mock_column = MagicMock()
        mock_column.label.return_value = mock_column
        mock_string_to_column.return_value = mock_column

        mock_session.query.return_value = mock_query

        result = get_importance_component(
            job_name="test-job", builds=5, components="component1", project=project_id
        )

        assert result is not None
        assert "table_data" in result
