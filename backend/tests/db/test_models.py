"""Tests for ibutsu_server.db.models module."""

from datetime import UTC, datetime

import pytest


class TestModelMixinUpdate:
    """Tests for ModelMixin.update method."""

    def test_update_does_not_mutate_caller_payload(self, make_run, flask_app):
        """Test update doesn't mutate caller's payload, including nested metadata."""
        client, _ = flask_app
        with client.application.app_context():
            run = make_run(metadata={"existing_key": "survives"})
            payload = {
                "id": "11111111-1111-1111-1111-111111111111",
                "component": "backend",
                "data": {"key": "value"},
            }
            payload_copy = {
                "id": payload["id"],
                "component": payload["component"],
                "data": payload["data"].copy(),
            }
            run.update(payload)
            assert "id" in payload
            assert "data" in payload
            assert payload == payload_copy
            assert "existing_key" not in payload["data"]

    def test_update_parses_datetime_strings(self, make_run, flask_app):
        """Test that update parses ISO datetime strings to datetime objects."""
        client, _ = flask_app
        with client.application.app_context():
            run = make_run()
            run.update({"start_time": "2026-08-26T10:00:00Z"})
            assert isinstance(run.start_time, datetime)
            assert run.start_time == datetime(2026, 8, 26, 10, 0, 0, tzinfo=UTC)

    def test_update_metadata_merges_and_preserves_existing_keys(self, make_run, flask_app):
        """Test that update with metadata merges new keys and preserves existing keys."""
        client, _ = flask_app
        with client.application.app_context():
            run = make_run(metadata={"existing_key": "val1", "shared_key": "old_val"})

            run.update({"metadata": {"shared_key": "new_val", "new_key": "val2"}})

            assert run.data["existing_key"] == "val1"
            assert run.data["shared_key"] == "new_val"
            assert run.data["new_key"] == "val2"

    def test_update_with_data_key_merges_correctly(self, make_run, flask_app):
        """Test that update with data key (instead of metadata) merges and preserves keys."""
        client, _ = flask_app
        with client.application.app_context():
            run = make_run(metadata={"existing_key": "val1", "shared_key": "old_val"})

            run.update({"data": {"shared_key": "new_val", "new_key": "val2"}})

            assert run.data["existing_key"] == "val1"
            assert run.data["shared_key"] == "new_val"
            assert run.data["new_key"] == "val2"

    @pytest.mark.parametrize(
        ("initial_meta", "update_payload", "expected_meta"),
        [
            (
                {"env": "prod", "cluster": "east"},
                {"metadata": {"cluster": "west"}},
                {"env": "prod", "cluster": "west"},
            ),
            (
                {"env": "prod", "cluster": "east"},
                {"data": {"cluster": "west"}},
                {"env": "prod", "cluster": "west"},
            ),
            (
                {"nested": {"a": 1, "b": 2}},
                {"metadata": {"nested": {"b": 3, "c": 4}}},
                {"nested": {"a": 1, "b": 3, "c": 4}},
            ),
        ],
    )
    def test_update_metadata_parametrized(
        self, make_run, flask_app, initial_meta, update_payload, expected_meta
    ):
        """Parametrized verification of metadata merge behavior across different payload formats."""
        client, _ = flask_app
        with client.application.app_context():
            run = make_run(metadata=initial_meta)
            run.update(update_payload)
            assert run.data == expected_meta
