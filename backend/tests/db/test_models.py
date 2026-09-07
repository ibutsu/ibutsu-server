"""Tests for ibutsu_server.db.models module."""

import pytest

from ibutsu_server.db.models import Run


class TestModelMixinUpdate:
    """Tests for ModelMixin.update method."""

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
