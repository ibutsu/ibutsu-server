import importlib.util
import io
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from ibutsu_server.db.models import Result


@pytest.fixture
def migration_module():
    """Load the efdaeff6dc95 migration module dynamically."""
    migration_path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "efdaeff6dc95_add_results_run_project_index.py"
    )
    spec = importlib.util.spec_from_file_location("migration_efdaeff6dc95", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_sqlite_upgrade_and_downgrade(migration_module, monkeypatch):
    """Test upgrade and downgrade operations on a SQLite database."""
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(
            sa.text("CREATE TABLE results (id TEXT PRIMARY KEY, run_id TEXT, project_id TEXT)")
        )

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        monkeypatch.setattr(migration_module.op, "_proxy", Operations(ctx), raising=False)

        # Test upgrade creates the index
        migration_module.upgrade()
        indexes = conn.execute(
            sa.text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='results'")
        ).fetchall()
        index_names = [row[0] for row in indexes]
        assert "ix_results_run_id_project_id" in index_names

        # Test downgrade drops the index
        migration_module.downgrade()
        indexes = conn.execute(
            sa.text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='results'")
        ).fetchall()
        index_names = [row[0] for row in indexes]
        assert "ix_results_run_id_project_id" not in index_names


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
    assert "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_run_id_project_id" in upgrade_sql

    buf.seek(0)
    buf.truncate(0)

    migration_module.downgrade()
    downgrade_sql = buf.getvalue()
    assert "DROP INDEX CONCURRENTLY IF EXISTS ix_results_run_id_project_id" in downgrade_sql


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

    migration_module._cleanup_invalid_index()

    assert mock_drop.called == should_drop
    if should_drop:
        mock_drop.assert_called_once_with(
            migration_module.INDEX_NAME,
            table_name=migration_module.TABLE_NAME,
            postgresql_concurrently=True,
            if_exists=True,
        )


def test_models_documentation():
    """Ensure ix_results_run_id_project_id is documented in Result docstring."""
    assert Result.__doc__ is not None
    doc_entry = "- ix_results_run_id_project_id: Composite index on (run_id, project_id)"
    assert doc_entry in Result.__doc__
