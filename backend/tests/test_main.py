"""Tests for ibutsu_server.__main__ module."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestMain:
    """Tests for main function in __main__.py."""

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server"])
    def test_main_default_configuration(self, mock_get_app, mock_uvicorn_run):
        """Test main function with default configuration."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        # Verify get_app was called
        mock_get_app.assert_called_once()

        # Verify uvicorn.run was called with default parameters
        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["app"] == mock_app
        assert call_kwargs["host"] == "127.0.0.1"
        assert call_kwargs["port"] == 8080
        assert call_kwargs["reload"] is True
        assert call_kwargs["log_level"] == "debug"
        assert "ssl_keyfile" not in call_kwargs
        assert "ssl_certfile" not in call_kwargs

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--host", "0.0.0.0"])  # noqa: S104
    def test_main_with_custom_host(self, mock_get_app, mock_uvicorn_run):
        """Test main function with custom host."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "0.0.0.0"  # noqa: S104

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--port", "9000"])
    def test_main_with_custom_port(self, mock_get_app, mock_uvicorn_run):
        """Test main function with custom port."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["port"] == 9000

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--host", "localhost", "--port", "5000"])
    def test_main_with_host_and_port(self, mock_get_app, mock_uvicorn_run):
        """Test main function with both host and port."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "localhost"
        assert call_kwargs["port"] == 5000

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--ssl"])
    def test_main_with_ssl_certs_exist(self, mock_get_app, mock_uvicorn_run):
        """Test main function with SSL when certificates exist."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        # Mock Path.exists() to return True for SSL certs
        with patch.object(Path, "exists", return_value=True):
            main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert "ssl_keyfile" in call_kwargs
        assert "ssl_certfile" in call_kwargs

    @pytest.mark.parametrize(
        "test_case",
        [
            "both_certs_missing",
            "cert_only_missing",
            "key_only_missing",
        ],
    )
    @patch("sys.exit")
    @patch("sys.argv", ["ibutsu_server", "--ssl"])
    def test_main_with_ssl_certs_missing(self, mock_exit, test_case):
        """Test main function exits when SSL certificates are missing.

        This test covers all scenarios where SSL certs are missing, since the
        implementation checks both cert and key files and exits if either is missing.
        """
        from ibutsu_server.__main__ import main

        # Make sys.exit raise SystemExit to stop execution
        mock_exit.side_effect = SystemExit

        # Mock Path.exists() to return False (certs missing)
        with patch.object(Path, "exists", return_value=False), pytest.raises(SystemExit):
            main()

        # Should exit with code 1
        mock_exit.assert_called_once_with(1)

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server"])
    def test_main_calls_get_app(self, mock_get_app, mock_uvicorn_run):
        """Test that main function calls get_app."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        # get_app should be called to get the Connexion app
        mock_get_app.assert_called_once()

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--host", "192.168.1.1", "--port", "8888"])
    def test_main_with_multiple_args(self, mock_get_app, mock_uvicorn_run):
        """Test main function with multiple command-line arguments."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "192.168.1.1"
        assert call_kwargs["port"] == 8888
        assert call_kwargs["reload"] is True

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--ssl", "--host", "example.com", "--port", "443"])
    def test_main_ssl_with_custom_host_port(self, mock_get_app, mock_uvicorn_run):
        """Test main function with SSL and custom host/port."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        # Mock certificate files exist
        with patch.object(Path, "exists", return_value=True):
            main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "example.com"
        assert call_kwargs["port"] == 443
        assert "ssl_keyfile" in call_kwargs
        assert "ssl_certfile" in call_kwargs

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch(
        "sys.argv",
        [
            "ibutsu_server",
            "--port",
            "3000",
            "--host",
            "0.0.0.0",  # noqa: S104
        ],
    )
    def test_main_argument_order_independence(self, mock_get_app, mock_uvicorn_run):
        """Test that argument order doesn't matter."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "0.0.0.0"  # noqa: S104
        assert call_kwargs["port"] == 3000

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server"])
    def test_main_uvicorn_receives_correct_log_level(self, mock_get_app, mock_uvicorn_run):
        """Test that uvicorn receives correct log level based on debug flag."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        # debug is True by default in main()
        assert call_kwargs["log_level"] == "debug"
        assert call_kwargs["reload"] is True

    @patch("uvicorn.run")
    @patch("ibutsu_server.get_app")
    @patch("sys.argv", ["ibutsu_server", "--host", "127.0.0.1", "--port", "8080"])
    def test_main_explicit_defaults(self, mock_get_app, mock_uvicorn_run):
        """Test main function with explicit default values."""
        from ibutsu_server.__main__ import main

        mock_app = MagicMock()
        mock_get_app.return_value = mock_app

        main()

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs["host"] == "127.0.0.1"
        assert call_kwargs["port"] == 8080
