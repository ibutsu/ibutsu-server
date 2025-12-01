"""Tests for database upgrades"""

import pytest
from sqlalchemy import MetaData

from ibutsu_server.db.upgrades import upgrade_10


class TestUpgrade10:
    """Tests for upgrade_10 - performance optimization indexes"""

    def test_upgrade_10_creates_composite_indexes(self, db_session):
        """Test that upgrade_10 creates expected composite B-tree indexes"""
        # Run the upgrade
        upgrade_10(db_session)

        # Get the current database metadata
        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        metadata = MetaData()
        metadata.reflect(bind=engine)

        # Define expected composite indexes
        expected_indexes = {
            "runs": [
                "ix_runs_project_id_start_time",
                "ix_runs_project_component_start_time",
            ],
            "results": [
                "ix_results_project_id_start_time",
                "ix_results_project_component_start_time",
                "ix_results_run_id_start_time",
            ],
        }

        # Verify each expected index exists
        for table_name, index_names in expected_indexes.items():
            table = metadata.tables.get(table_name)
            assert table is not None, f"Table {table_name} not found"

            existing_index_names = [idx.name for idx in table.indexes]
            for index_name in index_names:
                assert index_name in existing_index_names, (
                    f"Expected index {index_name} not found in {table_name}. "
                    f"Existing indexes: {existing_index_names}"
                )

    def test_upgrade_10_creates_jsonb_gin_indexes(self, db_session):
        """Test that upgrade_10 creates GIN indexes on JSONB paths"""
        # Run the upgrade
        upgrade_10(db_session)

        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        metadata = MetaData()
        metadata.reflect(bind=engine)

        # Define expected GIN indexes on JSONB paths
        expected_gin_indexes = {
            "runs": [
                "ix_runs_jenkins",
                "ix_runs_summary",
            ],
            "results": [
                "ix_results_jenkins",
                "ix_results_test_suite",
            ],
        }

        # Verify each expected GIN index exists
        for table_name, index_names in expected_gin_indexes.items():
            table = metadata.tables.get(table_name)
            assert table is not None, f"Table {table_name} not found"

            existing_index_names = [idx.name for idx in table.indexes]
            for index_name in index_names:
                assert index_name in existing_index_names, (
                    f"Expected GIN index {index_name} not found in {table_name}. "
                    f"Existing indexes: {existing_index_names}"
                )

    def test_upgrade_10_creates_trigram_indexes(self, db_session):
        """Test that upgrade_10 creates GIN trigram indexes for pattern matching"""
        # Run the upgrade
        upgrade_10(db_session)

        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        metadata = MetaData()
        metadata.reflect(bind=engine)

        # Define expected trigram indexes
        expected_trgm_indexes = {
            "runs": [
                "ix_runs_component_trgm",
                "ix_runs_source_trgm",
            ],
            "results": [
                "ix_results_component_trgm",
                "ix_results_source_trgm",
            ],
        }

        # Verify each expected trigram index exists
        for table_name, index_names in expected_trgm_indexes.items():
            table = metadata.tables.get(table_name)
            assert table is not None, f"Table {table_name} not found"

            existing_index_names = [idx.name for idx in table.indexes]
            for index_name in index_names:
                assert index_name in existing_index_names, (
                    f"Expected trigram index {index_name} not found in {table_name}. "
                    f"Existing indexes: {existing_index_names}"
                )

    def test_upgrade_10_enables_pg_trgm_extension(self, db_session):
        """Test that upgrade_10 enables the pg_trgm extension"""
        # Run the upgrade
        upgrade_10(db_session)

        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        # Query for installed extensions
        result = db_session.execute("SELECT * FROM pg_extension WHERE extname = 'pg_trgm'")
        extensions = result.fetchall()

        assert len(extensions) > 0, "pg_trgm extension not installed"

    def test_upgrade_10_idempotent(self, db_session):
        """Test that upgrade_10 can be run multiple times without errors"""
        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        # Run the upgrade twice
        upgrade_10(db_session)

        # Get index count before second run
        metadata = MetaData()
        metadata.reflect(bind=engine)
        runs_table = metadata.tables.get("runs")
        initial_index_count = len(runs_table.indexes) if runs_table else 0

        # Run again - should not raise errors
        upgrade_10(db_session)

        # Verify index count hasn't changed (no duplicates created)
        metadata = MetaData()
        metadata.reflect(bind=engine)
        runs_table = metadata.tables.get("runs")
        final_index_count = len(runs_table.indexes) if runs_table else 0

        assert final_index_count == initial_index_count, (
            "Running upgrade_10 twice should not create duplicate indexes"
        )

    def test_upgrade_10_skips_on_sqlite(self, db_session):
        """Test that upgrade_10 gracefully skips on SQLite databases"""
        engine = db_session.connection().engine

        # Only run this test on SQLite
        if engine.url.get_dialect().name != "sqlite":
            pytest.skip("This test is only for SQLite databases")

        # Should not raise any errors, just log and return
        upgrade_10(db_session)

        # No assertions needed - just verify it doesn't crash

    def test_upgrade_10_handles_missing_pg_trgm(self, db_session, monkeypatch):
        """Test that upgrade_10 handles missing pg_trgm extension gracefully"""
        engine = db_session.connection().engine

        # Skip test if not using PostgreSQL
        if engine.url.get_dialect().name != "postgresql":
            pytest.skip("Upgrade 10 only applies to PostgreSQL")

        # Mock session.execute to raise error for CREATE EXTENSION
        original_execute = db_session.execute

        def mock_execute(statement, *args, **kwargs):
            if "CREATE EXTENSION" in str(statement):
                raise Exception("Extension creation not permitted")
            return original_execute(statement, *args, **kwargs)

        monkeypatch.setattr(db_session, "execute", mock_execute)

        # Should not raise - just log warning and continue
        upgrade_10(db_session)

        # Note: Trigram indexes won't be created, but other indexes should be
        metadata = MetaData()
        metadata.reflect(bind=engine)

        # Verify at least composite indexes were created
        runs_table = metadata.tables.get("runs")
        existing_indexes = [idx.name for idx in runs_table.indexes]

        # Should have at least one of the composite indexes
        assert any(
            idx in existing_indexes
            for idx in ["ix_runs_project_id_start_time", "ix_runs_project_component_start_time"]
        ), "Should create composite indexes even if pg_trgm fails"
