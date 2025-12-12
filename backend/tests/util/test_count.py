"""Tests for ibutsu_server.util.count module"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text

from ibutsu_server.constants import COUNT_TIMEOUT
from ibutsu_server.db import db
from ibutsu_server.db.models import Result
from ibutsu_server.util.count import (
    _get_count_from_explain,
    get_count_estimate,
    time_limited_db_operation,
)


def test_get_count_from_explain():
    """Test parsing count from EXPLAIN output"""
    # Mock a query object
    mock_query = MagicMock()

    # Mock the EXPLAIN output format
    explain_output = "Seq Scan on results  (cost=0.00..100.00 rows=1234 width=100)"

    with patch("ibutsu_server.util.count.session") as mock_session:
        mock_session.execute.return_value.fetchall.return_value = [[explain_output]]

        result = _get_count_from_explain(mock_query)

        assert result == 1234
        mock_session.execute.assert_called_once()


def test_get_count_from_explain_with_different_formats():
    """Test parsing count from various EXPLAIN output formats"""
    test_cases = [
        ("Seq Scan on table  (cost=0.00..100.00 rows=500 width=100)", 500),
        ("Index Scan using idx on table  (cost=0.00..50.00 rows=10 width=50)", 10),
        ("Hash Join  (cost=100.00..200.00 rows=99999 width=200)", 99999),
    ]

    mock_query = MagicMock()

    for explain_output, expected_count in test_cases:
        with patch("ibutsu_server.util.count.session") as mock_session:
            mock_session.execute.return_value.fetchall.return_value = [[explain_output]]

            result = _get_count_from_explain(mock_query)
            assert result == expected_count


def test_get_count_estimate_with_no_filter(flask_app):
    """Test get_count_estimate with no_filter=True"""
    client, _ = flask_app

    with client.application.app_context():
        tablename = "results"

        with patch("ibutsu_server.util.count.session") as mock_session:
            # Mock the pg_class query result
            mock_session.execute.return_value.fetchall.return_value = [[1000]]

            result = get_count_estimate(None, no_filter=True, tablename=tablename)

            assert result == 1000
            # Verify the SQL query was executed with the tablename parameter
            mock_session.execute.assert_called_once()
            call_args = mock_session.execute.call_args
            assert isinstance(call_args[0][0], type(text("")))
            assert call_args[0][1] == {"tablename": tablename}


def test_get_count_estimate_with_filter_below_limit(flask_app, make_project, make_result):
    """Test get_count_estimate when estimate is below COUNT_ESTIMATE_LIMIT"""
    client, _ = flask_app

    with client.application.app_context():
        # Create test data
        project = make_project(name="test-project")
        for i in range(5):
            make_result(project_id=project.id, test_id=f"test_{i}")

        query = db.select(Result).where(Result.project_id == project.id)

        # Mock _get_count_from_explain to return a small estimate
        with patch("ibutsu_server.util.count._get_count_from_explain", return_value=5):
            result = get_count_estimate(query, no_filter=False)

            # Should perform actual count since estimate is below limit
            assert result == 5


def test_get_count_estimate_with_filter_above_limit(flask_app, make_project):
    """Test get_count_estimate when estimate is above COUNT_ESTIMATE_LIMIT"""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        query = db.select(Result).where(Result.project_id == project.id)

        # Mock _get_count_from_explain to return a large estimate
        large_estimate = 100000  # Above COUNT_ESTIMATE_LIMIT
        with patch("ibutsu_server.util.count._get_count_from_explain", return_value=large_estimate):
            result = get_count_estimate(query, no_filter=False)

            # Should return the estimate without performing actual count
            assert result == large_estimate


@pytest.mark.parametrize(
    ("timeout", "expected_timeout_ms"),
    [
        (1, 1000),
        (5, 5000),
        (10, 10000),
        (0.5, 500),
    ],
)
def test_time_limited_db_operation_with_timeout(timeout, expected_timeout_ms):
    """Test time_limited_db_operation with various timeout values"""
    with patch("ibutsu_server.util.count.session") as mock_session:
        with time_limited_db_operation(timeout=timeout):
            pass

        # Verify SET statement_timeout was called with correct value
        calls = mock_session.execute.call_args_list
        assert len(calls) == 2

        # First call sets the timeout
        first_call = calls[0][0][0]
        assert "SET statement_timeout TO" in str(first_call)
        assert calls[0][0][1] == {"timeout": expected_timeout_ms}

        # Second call resets the timeout
        second_call = calls[1][0][0]
        assert "SET statement_timeout TO 0" in str(second_call)


def test_time_limited_db_operation_without_timeout():
    """Test time_limited_db_operation uses default timeout when none provided"""

    expected_timeout_ms = int(COUNT_TIMEOUT * 1000)

    with patch("ibutsu_server.util.count.session") as mock_session:
        with time_limited_db_operation():
            pass

        # Verify SET statement_timeout was called with default value
        calls = mock_session.execute.call_args_list
        assert len(calls) == 2

        # First call sets the timeout to default
        assert calls[0][0][1] == {"timeout": expected_timeout_ms}


def test_time_limited_db_operation_resets_on_exception():
    """Test that time_limited_db_operation resets timeout even on exception"""
    with patch("ibutsu_server.util.count.session") as mock_session:
        with (
            pytest.raises(ValueError, match="Test exception"),
            time_limited_db_operation(timeout=5),
        ):
            raise ValueError("Test exception")

        # Verify timeout was reset even though exception was raised
        calls = mock_session.execute.call_args_list
        assert len(calls) == 2

        # Second call should still reset the timeout
        second_call = calls[1][0][0]
        assert "SET statement_timeout TO 0" in str(second_call)


def test_get_count_estimate_with_empty_table(flask_app, make_project):
    """Test get_count_estimate with an empty table"""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Query for results that don't exist
        query = db.select(Result).where(Result.project_id == project.id)

        # Mock _get_count_from_explain to return 0
        with patch("ibutsu_server.util.count._get_count_from_explain", return_value=0):
            result = get_count_estimate(query, no_filter=False)

            # Should perform actual count and return 0
            assert result == 0


def test_time_limited_db_operation_context_manager_behavior():
    """Test that time_limited_db_operation properly enters and exits context"""
    with patch("ibutsu_server.util.count.session") as mock_session:
        # Track whether we're inside the context
        inside_context = False

        with time_limited_db_operation(timeout=1):
            inside_context = True
            # Verify timeout was set
            assert mock_session.execute.call_count == 1

        # Verify we exited the context
        assert inside_context is True
        # Verify timeout was reset
        assert mock_session.execute.call_count == 2


@pytest.mark.parametrize(
    "tablename",
    [
        "results",
        "runs",
        "projects",
        "artifacts",
    ],
)
def test_get_count_estimate_no_filter_with_various_tables(tablename):
    """Test get_count_estimate with no_filter for various table names"""
    with patch("ibutsu_server.util.count.session") as mock_session:
        mock_session.execute.return_value.fetchall.return_value = [[500]]

        result = get_count_estimate(None, no_filter=True, tablename=tablename)

        assert result == 500
        # Verify correct tablename was passed
        call_args = mock_session.execute.call_args
        assert call_args[0][1] == {"tablename": tablename}
