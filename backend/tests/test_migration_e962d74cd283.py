import importlib.util
import io
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from ibutsu_server.db.models import Result, Run

INDEX_NAMES = (
    "ix_runs_project_id_start_time",
    "ix_results_test_id_start_time",
    "ix_runs_source_trgm",
    "ix_runs_component_trgm",
    "ix_results_test_id_trgm",
)

UPGRADE_SQL = (
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_runs_project_id_start_time "
    "ON runs (project_id, start_time DESC)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_test_id_start_time "
    "ON results (test_id, start_time DESC)",
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_runs_source_trgm "
    "ON runs USING gin (source gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_runs_component_trgm "
    "ON runs USING gin (component gin_trgm_ops)",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_test_id_trgm "
    "ON results USING gin (test_id gin_trgm_ops)",
)

DOWNGRADE_SQL = (
    "DROP INDEX CONCURRENTLY IF EXISTS ix_results_test_id_trgm",
    "DROP INDEX CONCURRENTLY IF EXISTS ix_runs_component_trgm",
    "DROP INDEX CONCURRENTLY IF EXISTS ix_runs_source_trgm",
    "DROP EXTENSION IF EXISTS pg_trgm",
    "DROP INDEX CONCURRENTLY IF EXISTS ix_results_test_id_start_time",
    "DROP INDEX CONCURRENTLY IF EXISTS ix_runs_project_id_start_time",
)


@pytest.fixture
def migration_module():
    """Load the e962d74cd283 migration module dynamically."""
    migration_path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "e962d74cd283_add_composite_and_trigram_indexes_for_.py"
    )
    spec = importlib.util.spec_from_file_location("migration_e962d74cd283", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _sqlite_index_names(conn):
    rows = conn.execute(sa.text("SELECT name FROM sqlite_master WHERE type = 'index'")).fetchall()
    return [row[0] for row in rows]


def test_sqlite_upgrade_and_downgrade(migration_module, monkeypatch):
    """SQLite skips the PostgreSQL indexes on upgrade and downgrade."""
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE runs ("
                "id TEXT PRIMARY KEY, project_id TEXT, start_time TEXT, "
                "source TEXT, component TEXT"
                ")"
            )
        )
        conn.execute(
            sa.text("CREATE TABLE results (id TEXT PRIMARY KEY, test_id TEXT, start_time TEXT)")
        )

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        monkeypatch.setattr(migration_module.op, "_proxy", Operations(ctx), raising=False)

        migration_module.upgrade()
        index_names = _sqlite_index_names(conn)
        for index_name in INDEX_NAMES:
            assert index_name not in index_names

        migration_module.upgrade()

        migration_module.downgrade()
        index_names = _sqlite_index_names(conn)
        for index_name in INDEX_NAMES:
            assert index_name not in index_names


@pytest.mark.parametrize("bind_returns_none", [False, True])
def test_postgresql_offline_upgrade_and_downgrade(migration_module, monkeypatch, bind_returns_none):
    """Offline PostgreSQL SQL creates and drops the indexes in migration order."""
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
    upgrade_positions = []
    for statement in UPGRADE_SQL:
        assert statement in upgrade_sql
        upgrade_positions.append(upgrade_sql.index(statement))
    assert upgrade_positions == sorted(upgrade_positions)

    buf.seek(0)
    buf.truncate(0)

    migration_module.downgrade()
    downgrade_sql = buf.getvalue()
    downgrade_positions = []
    for statement in DOWNGRADE_SQL:
        assert statement in downgrade_sql
        downgrade_positions.append(downgrade_sql.index(statement))
    assert downgrade_positions == sorted(downgrade_positions)


def test_models_documentation():
    """New PostgreSQL indexes are described on Result and Run."""
    assert Result.__doc__ is not None
    assert "- ix_results_test_id_start_time: Composite (test_id, start_time DESC)" in Result.__doc__
    assert (
        "- ix_results_test_id_trgm: GIN trigram index on test_id (pg_trgm, gin_trgm_ops)"
        in Result.__doc__
    )

    assert Run.__doc__ is not None
    assert "- ix_runs_project_id_start_time: Composite (project_id, start_time DESC)" in Run.__doc__
    assert (
        "- ix_runs_source_trgm: GIN trigram index on source (pg_trgm, gin_trgm_ops)" in Run.__doc__
    )
    assert (
        "- ix_runs_component_trgm: GIN trigram index on component (pg_trgm, gin_trgm_ops)"
        in Run.__doc__
    )
