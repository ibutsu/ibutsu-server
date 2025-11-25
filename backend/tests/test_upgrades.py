"""Tests for database upgrades"""

import pytest
from sqlalchemy import MetaData, text

from ibutsu_server.db.upgrades import upgrade_10, upgrade_11


@pytest.fixture
def requires_postgresql(db_session):
    """Skip test if not using PostgreSQL"""
    engine = db_session.connection().engine
    if engine.url.get_dialect().name != "postgresql":
        pytest.skip("This test only applies to PostgreSQL")


@pytest.fixture
def requires_sqlite(db_session):
    """Skip test if not using SQLite"""
    engine = db_session.connection().engine
    if engine.url.get_dialect().name != "sqlite":
        pytest.skip("This test is only for SQLite databases")


def _get_index_definition(engine, table_name, index_name):
    """Get index definition from PostgreSQL system catalogs"""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND tablename = :table_name
                  AND indexname = :index_name
                """
            ),
            {"table_name": table_name, "index_name": index_name},
        )
        return result.scalar_one_or_none()


def _verify_gin_index(engine, table_name, index_name, expected_column=None):
    """Verify that an index is a GIN index and optionally check the column"""
    indexdef = _get_index_definition(engine, table_name, index_name)
    assert indexdef is not None, (
        f"Expected GIN index {index_name} on {table_name} to exist in pg_indexes"
    )

    normalized_indexdef = indexdef.lower()

    # Assert that the index uses the GIN index method
    assert "using gin" in normalized_indexdef, (
        f"Index {index_name} is not a GIN index. Definition: {indexdef}"
    )

    # If expected_column is provided, verify it's in the definition
    if expected_column:
        # The definition is typically like:
        #   CREATE INDEX ix_name ON public.table USING gin (column)
        #   or for expressions: CREATE INDEX ix_name ON public.table USING gin ((expression))
        assert (
            f"({expected_column})" in normalized_indexdef
            or f" {expected_column} " in normalized_indexdef
            or f"({expected_column})" in normalized_indexdef
        ), (
            f"Index {index_name} does not appear to be on the {expected_column} column. "
            f"Definition: {indexdef}"
        )


def _verify_trigram_index(engine, table_name, index_name, column_name):
    """Verify that an index is a GIN trigram index with gin_trgm_ops"""
    indexdef = _get_index_definition(engine, table_name, index_name)
    assert indexdef is not None, (
        f"Expected trigram index {index_name} on {table_name} to exist in pg_indexes"
    )

    normalized_indexdef = indexdef.lower()

    # Assert that the index uses the GIN index method
    assert "using gin" in normalized_indexdef, (
        f"Index {index_name} is not a GIN index. Definition: {indexdef}"
    )

    # Assert that it uses gin_trgm_ops operator class
    assert "gin_trgm_ops" in normalized_indexdef, (
        f"Index {index_name} does not use gin_trgm_ops operator class. Definition: {indexdef}"
    )

    # Assert that it targets the expected column
    assert (
        f"({column_name} gin_trgm_ops)" in normalized_indexdef
        or f"{column_name} gin_trgm_ops" in normalized_indexdef
    ), (
        f"Index {index_name} does not appear to be on the {column_name} column "
        f"with gin_trgm_ops. Definition: {indexdef}"
    )


class TestUpgrade10:
    """Tests for upgrade_10 - result-aggregator optimization indexes"""

    @pytest.mark.parametrize(
        "index_name",
        [
            "ix_results_data_gin",
            "ix_results_project_start_time",
            "ix_results_project_start_component",
        ],
    )
    def test_upgrade_10_creates_index(self, db_session, requires_postgresql, index_name):
        """Test that upgrade_10 creates expected indexes"""
        upgrade_10(db_session)

        engine = db_session.connection().engine
        metadata = MetaData()
        metadata.reflect(bind=engine)

        results_table = metadata.tables.get("results")
        assert results_table is not None, "Results table not found"

        existing_index_names = [idx.name for idx in results_table.indexes]
        assert index_name in existing_index_names, (
            f"Expected index {index_name} not found. Existing indexes: {existing_index_names}"
        )

    def test_upgrade_10_creates_data_gin_index_type(self, db_session, requires_postgresql):
        """Test that upgrade_10 creates GIN index on results.data column with correct type"""
        upgrade_10(db_session)

        engine = db_session.connection().engine
        _verify_gin_index(engine, "results", "ix_results_data_gin", "data")

    def test_upgrade_10_idempotent(self, db_session, requires_postgresql):
        """Test that upgrade_10 can be run multiple times without errors"""
        upgrade_10(db_session)

        # Get index count before second run
        engine = db_session.connection().engine
        metadata = MetaData()
        metadata.reflect(bind=engine)
        results_table = metadata.tables.get("results")
        initial_index_count = len(results_table.indexes) if results_table else 0

        # Run again - should not raise errors
        upgrade_10(db_session)

        # Verify index count hasn't changed (no duplicates created)
        metadata = MetaData()
        metadata.reflect(bind=engine)
        results_table = metadata.tables.get("results")
        final_index_count = len(results_table.indexes) if results_table else 0

        assert final_index_count == initial_index_count, (
            "Running upgrade_10 twice should not create duplicate indexes"
        )

    def test_upgrade_10_skips_on_sqlite(self, db_session, requires_sqlite):
        """Test that upgrade_10 gracefully skips on SQLite databases"""
        # Should not raise any errors, just log and return
        upgrade_10(db_session)

    def test_upgrade_10_handles_missing_results_table(
        self, db_session, requires_postgresql, monkeypatch
    ):
        """Test that upgrade_10 handles missing results table gracefully"""
        # Mock metadata.tables.get to return None for results table
        original_reflect = MetaData.reflect

        def mock_reflect(self, *args, **kwargs):
            original_reflect(self, *args, **kwargs)
            # Remove results table from metadata
            if "results" in self.tables:
                del self.tables["results"]

        monkeypatch.setattr(MetaData, "reflect", mock_reflect)

        # Should not raise - just log warning and return
        upgrade_10(db_session)


class TestUpgrade11:
    """Tests for upgrade_11 - widget query pattern optimization indexes"""

    @pytest.mark.parametrize(
        ("table_name", "index_name"),
        [
            ("runs", "ix_runs_project_id_start_time"),
            ("results", "ix_results_project_id_start_time"),
            ("runs", "ix_runs_project_component_start_time"),
            ("results", "ix_results_project_component_start_time"),
            ("results", "ix_results_run_id_start_time"),
        ],
    )
    def test_upgrade_11_creates_composite_indexes(
        self, db_session, requires_postgresql, table_name, index_name
    ):
        """Test that upgrade_11 creates composite indexes"""
        upgrade_11(db_session)

        engine = db_session.connection().engine
        metadata = MetaData()
        metadata.reflect(bind=engine)

        table = metadata.tables.get(table_name)
        assert table is not None, f"{table_name} table not found"

        existing_index_names = [idx.name for idx in table.indexes]
        assert index_name in existing_index_names, (
            f"Expected index {index_name} not found. Existing indexes: {existing_index_names}"
        )

    @pytest.mark.parametrize(
        ("table_name", "index_name", "path_expression"),
        [
            ("runs", "ix_runs_jenkins", "data->'jenkins'"),
            ("results", "ix_results_jenkins", "data->'jenkins'"),
            ("results", "ix_results_test_suite", "data->'test_suite'"),
        ],
    )
    def test_upgrade_11_creates_jsonb_gin_indexes(
        self, db_session, requires_postgresql, table_name, index_name, path_expression
    ):
        """Test that upgrade_11 creates GIN indexes on JSONB paths"""
        upgrade_11(db_session)

        engine = db_session.connection().engine
        _verify_gin_index(engine, table_name, index_name)

    def test_upgrade_11_creates_summary_gin_index(self, db_session, requires_postgresql):
        """Test that upgrade_11 creates GIN index on runs.summary column"""
        upgrade_11(db_session)

        engine = db_session.connection().engine
        _verify_gin_index(engine, "runs", "ix_runs_summary", "summary")

    @pytest.mark.parametrize(
        ("table_name", "index_name", "column_name"),
        [
            ("runs", "ix_runs_component_trgm", "component"),
            ("results", "ix_results_component_trgm", "component"),
            ("runs", "ix_runs_source_trgm", "source"),
            ("results", "ix_results_source_trgm", "source"),
        ],
    )
    def test_upgrade_11_creates_trigram_indexes(
        self, db_session, requires_postgresql, table_name, index_name, column_name
    ):
        """Test that upgrade_11 creates trigram indexes with gin_trgm_ops"""
        upgrade_11(db_session)

        engine = db_session.connection().engine
        _verify_trigram_index(engine, table_name, index_name, column_name)

    def test_upgrade_11_idempotent(self, db_session, requires_postgresql):
        """Test that upgrade_11 can be run multiple times without errors"""
        upgrade_11(db_session)

        # Get index count before second run
        engine = db_session.connection().engine
        metadata = MetaData()
        metadata.reflect(bind=engine)
        runs_table = metadata.tables.get("runs")
        initial_index_count = len(runs_table.indexes) if runs_table else 0

        # Run again - should not raise errors
        upgrade_11(db_session)

        # Verify index count hasn't changed (no duplicates created)
        metadata = MetaData()
        metadata.reflect(bind=engine)
        runs_table = metadata.tables.get("runs")
        final_index_count = len(runs_table.indexes) if runs_table else 0

        assert final_index_count == initial_index_count, (
            "Running upgrade_11 twice should not create duplicate indexes"
        )

    def test_upgrade_11_skips_on_sqlite(self, db_session, requires_sqlite):
        """Test that upgrade_11 gracefully skips on SQLite databases"""
        # Should not raise any errors, just log and return
        upgrade_11(db_session)

    def test_upgrade_11_handles_missing_pg_trgm(self, db_session, requires_postgresql, monkeypatch):
        """Test that upgrade_11 handles missing pg_trgm extension gracefully"""
        # Mock session.execute to raise error for CREATE EXTENSION
        original_execute = db_session.execute

        def mock_execute(statement, *args, **kwargs):
            if "CREATE EXTENSION" in str(statement):
                raise RuntimeError("Extension creation not permitted")
            return original_execute(statement, *args, **kwargs)

        monkeypatch.setattr(db_session, "execute", mock_execute)

        # Should not raise - just log warning and continue
        upgrade_11(db_session)

        # Note: Trigram indexes won't be created, but other indexes should be
        engine = db_session.connection().engine
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
