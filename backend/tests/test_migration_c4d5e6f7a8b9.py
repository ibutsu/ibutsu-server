import importlib.util
from pathlib import Path

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


def test_alembic_heads_single_head():
    """Verify that Alembic has exactly one head revision in the migration graph."""
    alembic_ini = Path(__file__).parent.parent / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini))
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    heads = script_dir.get_heads()
    assert len(heads) == 1
    assert heads[0] == "c4d5e6f7a8b9"


def test_sqlite_upgrade_and_downgrade(migration_module, monkeypatch):
    """Test upgrade and downgrade operations on a SQLite database."""
    engine = sa.create_engine("sqlite:///:memory:")
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

        artifact_indexes = {
            row[0]
            for row in conn.execute(
                sa.text(
                    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='artifacts'"
                )
            ).fetchall()
        }
        assert "ix_artifacts_result_id_filename" in artifact_indexes
        assert "ix_artifacts_run_id_filename" in artifact_indexes

        result_indexes = {
            row[0]
            for row in conn.execute(
                sa.text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='results'")
            ).fetchall()
        }
        assert "ix_results_run_id_test_id" in result_indexes

        # Test idempotent upgrade does not error
        migration_module.upgrade()

        # Test downgrade drops all three composite indexes
        migration_module.downgrade()

        artifact_indexes = {
            row[0]
            for row in conn.execute(
                sa.text(
                    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='artifacts'"
                )
            ).fetchall()
        }
        assert "ix_artifacts_result_id_filename" not in artifact_indexes
        assert "ix_artifacts_run_id_filename" not in artifact_indexes

        result_indexes = {
            row[0]
            for row in conn.execute(
                sa.text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='results'")
            ).fetchall()
        }
        assert "ix_results_run_id_test_id" not in result_indexes

        # Test idempotent downgrade does not error
        migration_module.downgrade()


def test_models_documentation():
    """Ensure composite indexes are documented in model docstrings."""
    assert Artifact.__doc__ is not None
    assert "ix_artifacts_result_id_filename" in Artifact.__doc__
    assert "ix_artifacts_run_id_filename" in Artifact.__doc__

    assert Result.__doc__ is not None
    assert "ix_results_run_id_test_id: Composite index on (run_id, test_id)" in Result.__doc__
