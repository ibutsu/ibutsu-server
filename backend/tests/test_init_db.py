import importlib.util
import logging
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Load init_db script as a module
INIT_DB_PATH = Path(__file__).parent.parent / "scripts" / "init_db.py"
spec = importlib.util.spec_from_file_location("init_db", str(INIT_DB_PATH))
init_db = importlib.util.module_from_spec(spec)
spec.loader.exec_module(init_db)


@pytest.fixture
def logger():
    return logging.getLogger("test_init_db")


def test_check_database_connection_success_first_attempt(app_context, logger):
    """Test successful database connection on the first attempt."""
    mock_connect = MagicMock()
    with patch.object(init_db.db.engine, "connect", mock_connect):
        init_db.check_database_connection(logger, max_retries=3, retry_interval=0)
    assert mock_connect.call_count == 1


def test_check_database_connection_success_after_retries(app_context, logger):
    """Test successful database connection after initial failures."""
    mock_connect = MagicMock()
    mock_connect.side_effect = [
        Exception("Connection refused"),
        Exception("Connection refused"),
        MagicMock(),
    ]

    with (
        patch.object(init_db.db.engine, "connect", mock_connect),
        patch("time.sleep") as mock_sleep,
    ):
        init_db.check_database_connection(logger, max_retries=3, retry_interval=1)

    assert mock_connect.call_count == 3
    assert mock_sleep.call_count == 2
    mock_sleep.assert_called_with(1)


def test_check_database_connection_failure_exhausts_retries(app_context, logger):
    """Test database connection failure exits after exhausting all retries."""
    mock_connect = MagicMock()
    mock_connect.side_effect = Exception("Connection refused")

    with (
        patch.object(init_db.db.engine, "connect", mock_connect),
        patch("time.sleep"),
        pytest.raises(SystemExit) as excinfo,
    ):
        init_db.check_database_connection(logger, max_retries=3, retry_interval=0)

    assert excinfo.value.code == 1
    assert mock_connect.call_count == 3


def test_check_database_connection_respects_env_vars(app_context, logger, monkeypatch):
    """Test that retry settings can be configured via environment variables."""
    monkeypatch.setenv("DB_CONNECT_RETRIES", "2")
    monkeypatch.setenv("DB_CONNECT_RETRY_INTERVAL", "0")

    mock_connect = MagicMock()
    mock_connect.side_effect = Exception("Connection refused")

    with (
        patch.object(init_db.db.engine, "connect", mock_connect),
        patch("time.sleep"),
        pytest.raises(SystemExit) as excinfo,
    ):
        init_db.check_database_connection(logger)

    assert excinfo.value.code == 1
    assert mock_connect.call_count == 2
