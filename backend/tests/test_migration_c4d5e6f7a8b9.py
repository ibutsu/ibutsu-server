import importlib.util
import io
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

from ibutsu_server.db.models import Artifact, Result


@pytest.fixture
def migration_module():
    """Load the c4d5e6f7a8b9 migration module dynamically."""
    migration_path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "c4d5e6f7a8b9_add_composite_indexes_artifacts_idempotency.py"
    )
    spec = importlib.util.spec_from_file_location("migration_c4d5e6f7a8b9", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def sqlite_engine():
    """Create a SQLite engine and dispose its pooled connection after the test."""
    engine = sa.create_engine("sqlite:///:memory:")
    yield engine
    engine.dispose()


def test_alembic_heads_single_head():
    """Verify that Alembic has exactly one head revision in the migration graph."""
    alembic_ini = Path(__file__).parent.parent / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(alembic_ini.parent / "alembic"))
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    heads = script_dir.get_heads()
    assert len(heads) == 1
    assert heads[0] == "c4d5e6f7a8b9"


def test_sqlite_upgrade_and_downgrade(migration_module, monkeypatch, sqlite_engine):
    """Test upgrade and downgrade operations on a SQLite database with column verification."""
    engine = sqlite_engine
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE artifacts ("
                "id TEXT PRIMARY KEY, result_id TEXT, run_id TEXT, filename TEXT"
                ")"
            )
        )
        conn.execute(
            sa.text("CREATE TABLE results (id TEXT PRIMARY KEY, run_id TEXT, test_id TEXT)")
        )

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        monkeypatch.setattr(migration_module.op, "_proxy", Operations(ctx), raising=False)

        # Test upgrade creates all three composite indexes
        migration_module.upgrade()

        inspector = sa.inspect(conn)
        artifact_indexes = {
            idx["name"]: idx["column_names"] for idx in inspector.get_indexes("artifacts")
        }
        result_indexes = {
            idx["name"]: idx["column_names"] for idx in inspector.get_indexes("results")
        }

        # Assert index existence AND column composition/order
        assert artifact_indexes.get("ix_artifacts_result_id_filename") == [
            "result_id",
            "filename",
        ]
        assert artifact_indexes.get("ix_artifacts_run_id_filename") == ["run_id", "filename"]
        assert result_indexes.get("ix_results_run_id_test_id") == ["run_id", "test_id"]

        # Test idempotent upgrade does not error
        migration_module.upgrade()

        # Test downgrade drops all three composite indexes
        migration_module.downgrade()

        inspector_post_down = sa.inspect(conn)
        artifact_down_indexes = {
            idx["name"] for idx in inspector_post_down.get_indexes("artifacts")
        }
        result_down_indexes = {idx["name"] for idx in inspector_post_down.get_indexes("results")}

        assert "ix_artifacts_result_id_filename" not in artifact_down_indexes
        assert "ix_artifacts_run_id_filename" not in artifact_down_indexes
        assert "ix_results_run_id_test_id" not in result_down_indexes

        # Test idempotent downgrade does not error
        migration_module.downgrade()


@pytest.mark.parametrize("bind_returns_none", [False, True])
def test_postgresql_offline_upgrade_and_downgrade(migration_module, monkeypatch, bind_returns_none):
    """Test SQL generation in offline mode for PostgreSQL dialect."""
    buf = io.StringIO()
    ctx = MigrationContext.configure(
        url="postgresql://user:pass@localhost/db",
        opts={"as_sql": True, "output_buffer": buf},
    )
    monkeypatch.setattr(migration_module.op, "_proxy", Operations(ctx), raising=False)
    if bind_returns_none:
        monkeypatch.setattr(migration_module.op, "get_bind", lambda: None)

    migration_module.upgrade()
    upgrade_sql = buf.getvalue()
    assert (
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artifacts_result_id_filename"
        " ON artifacts (result_id, filename)" in upgrade_sql
    )
    assert (
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artifacts_run_id_filename"
        " ON artifacts (run_id, filename)" in upgrade_sql
    )
    assert (
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_run_id_test_id"
        " ON results (run_id, test_id)" in upgrade_sql
    )

    buf.seek(0)
    buf.truncate(0)

    migration_module.downgrade()
    downgrade_sql = buf.getvalue()
    assert "DROP INDEX CONCURRENTLY IF EXISTS ix_results_run_id_test_id" in downgrade_sql
    assert "DROP INDEX CONCURRENTLY IF EXISTS ix_artifacts_run_id_filename" in downgrade_sql
    assert "DROP INDEX CONCURRENTLY IF EXISTS ix_artifacts_result_id_filename" in downgrade_sql


@pytest.mark.parametrize(
    ("row_result", "should_drop"),
    [
        ((False,), True),
        ((True,), False),
        (None, False),
    ],
)
def test_cleanup_invalid_index(migration_module, monkeypatch, row_result, should_drop):
    """Test that invalid indexes are dropped and valid/missing indexes are untouched."""
    mock_bind = MagicMock()
    mock_bind.execute.return_value.fetchone.return_value = row_result
    mock_drop = MagicMock()

    monkeypatch.setattr(migration_module.op, "get_bind", MagicMock(return_value=mock_bind))
    monkeypatch.setattr(migration_module.op, "drop_index", mock_drop)
    monkeypatch.setattr(migration_module, "_is_offline", lambda: False)

    migration_module._cleanup_invalid_index("ix_artifacts_result_id_filename", "artifacts")

    assert mock_drop.called == should_drop
    if should_drop:
        mock_drop.assert_called_once_with(
            "ix_artifacts_result_id_filename",
            table_name="artifacts",
            postgresql_concurrently=True,
            if_exists=True,
        )


def test_cleanup_invalid_index_offline(migration_module, monkeypatch):
    """Test that invalid index cleanup is skipped in offline mode."""
    mock_bind = MagicMock()
    mock_drop = MagicMock()
    monkeypatch.setattr(migration_module.op, "get_bind", MagicMock(return_value=mock_bind))
    monkeypatch.setattr(migration_module.op, "drop_index", mock_drop)
    monkeypatch.setattr(migration_module, "_is_offline", lambda: True)

    migration_module._cleanup_invalid_index("ix_artifacts_result_id_filename", "artifacts")
    assert not mock_bind.execute.called
    assert not mock_drop.called


def test_models_documentation():
    """Ensure composite indexes are documented in model docstrings."""
    assert Artifact.__doc__ is not None
    assert "ix_artifacts_result_id_filename" in Artifact.__doc__
    assert "ix_artifacts_run_id_filename" in Artifact.__doc__

    assert Result.__doc__ is not None
    assert "ix_results_run_id_test_id: Composite index on (run_id, test_id)" in Result.__doc__
