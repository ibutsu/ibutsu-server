import logging
import warnings
from contextlib import contextmanager
from datetime import datetime, timezone

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.sql import quoted_name

try:
    from sqlalchemy.exc import SAWarning
except ImportError:
    # Fallback for older SQLAlchemy versions
    SAWarning = None

from sqlalchemy.sql.expression import null

from ibutsu_server.constants import WIDGET_TYPES
from ibutsu_server.db.base import Boolean, Column, DateTime, ForeignKey, Text
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.db.types import PortableUUID

__version__ = 11


def get_upgrade_op(session):
    """
    Create a migration context and an operations object for performing upgrades.

    :param session: The SQLAlchemy session object.
    """
    connection = session.connection()
    context = MigrationContext.configure(connection)
    return Operations(context)


def upgrade_1(session):
    """Version 1 upgrade

    This upgrade adds a dashboard_id to the widget_configs table
    """
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    widget_configs = metadata.tables.get("widget_configs")
    if (
        "dashboards" in metadata.tables
        and widget_configs is not None
        and "dashboard_id" not in [col.name for col in widget_configs.columns]
    ):
        op.add_column(
            "widget_configs",
            Column("dashboard_id", PortableUUID, server_default=null()),
        )
        if engine.url.get_dialect().name != "sqlite":
            # SQLite doesn't support ALTER TABLE ADD CONSTRAINT
            op.create_foreign_key(
                "fk_widget_configs_dashboard_id",
                "widget_configs",
                "dashboards",
                ["dashboard_id"],
                ["id"],
            )
    if metadata.tables["projects"].columns["owner_id"].type in ["TEXT", "CLOB"]:
        # This is wrong and never worked. can't pass schema to alter_column
        op.alter_column(
            "projects",
            "owner_id",
            schema=Column(PortableUUID(), ForeignKey("users.id"), index=True),
        )


def upgrade_2(session):
    """Version 2 upgrade

    This upgrade adds indices for the metadata.tags, metadata.requirements fields in the
    results/runs tables.

    It is equivalent to running the following SQL statements:
        CREATE INDEX IF NOT EXISTS ix_runs_tags ON runs USING gin ((data->'tags'));
        CREATE INDEX IF NOT EXISTS ix_results_tags ON results USING gin ((data->'tags'));
        CREATE INDEX IF NOT EXISTS ix_results_requirements ON results
            USING gin ((data->'requirements'));
    """
    TABLES = ["runs", "results"]
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)

    if engine.url.get_dialect().name == "postgresql":
        for table_name in TABLES:
            tags_index_name = f"ix_{table_name}_tags"
            reqs_index_name = f"ix_{table_name}_requirements"
            table = metadata.tables.get(table_name)
            if (
                table_name in metadata.tables
                and table is not None
                and tags_index_name not in [idx.name for idx in table.indexes]
            ):
                op.create_index(
                    tags_index_name,
                    table_name,
                    [quoted_name("(data->'tags')", False)],
                    postgresql_using="gin",
                )
                if table_name == "results" and reqs_index_name not in [
                    idx.name for idx in table.indexes
                ]:
                    op.create_index(
                        reqs_index_name,
                        table_name,
                        [quoted_name("(data->'requirements')", False)],
                        postgresql_using="gin",
                    )


def upgrade_3(session):
    """Version 3 upgrade

    This upgrade:
        - makes the 'result_id' column of artifacts nullable
        - adds a 'run_id' to the artifacts table
    """
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    artifacts = metadata.tables.get("artifacts")
    if (
        "runs" in metadata.tables
        and artifacts is not None
        and "run_id" not in [col.name for col in artifacts.columns]
    ):
        op.alter_column("artifacts", "result_id", nullable=True, server_default=null())
        op.add_column("artifacts", Column("run_id", PortableUUID, server_default=null()))
        if engine.url.get_dialect().name != "sqlite":
            # SQLite doesn't support ALTER TABLE ADD CONSTRAINT
            op.create_foreign_key(
                "fk_artifacts_run_id",
                "artifacts",
                "runs",
                ["run_id"],
                ["id"],
            )


def upgrade_4(session):
    """Version 4 upgrade

    This upgrade removes the "nullable" constraint on the password field, and adds a "is_superadmin"
    field to the user table.
    """
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    users = metadata.tables.get("users")

    if (
        "users" in metadata.tables
        and users is not None
        and "is_superadmin" not in [col.name for col in users.columns]
    ):
        op.alter_column("users", "_password", nullable=True)
        op.add_column("users", Column("is_superadmin", Boolean, default=False))
        op.add_column("users", Column("is_active", Boolean, default=False))
        op.add_column("users", Column("activation_code", Text, default=None))


def upgrade_5(session):
    """Version 5 upgrade

    This upgrade adds a default dashboard to a project
    """
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    projects = metadata.tables.get("projects")

    if (
        "projects" in metadata.tables
        and projects is not None
        and "default_dashboard_id" not in [col.name for col in projects.columns]
    ):
        op.add_column(
            "projects",
            Column("default_dashboard_id", PortableUUID(), ForeignKey("dashboards.id")),
        )


def upgrade_6(session):
    """Version 6 upgrade

    This upgrade repairs broken field types on tables not matching schema

    Investigating the failure of the controllers.admin.user_controller.admin_delete_user function
    it was found that the Project.owner_id field in the stage and prod database are TEXT instead of
    PortableUUID.
    """

    engine = session.connection().engine
    op = get_upgrade_op(session)

    inspector = inspect(engine)

    text_columns = [
        c
        for c in inspector.get_columns("projects")
        if (c["name"] == "owner_id" and isinstance(c["type"], Text))
    ]

    if len(text_columns) > 0:
        op.alter_column(
            table_name="projects",
            column_name="owner_id",
            existing_type=Text,
            type_=PortableUUID(),
            existing_nullable=True,
            postgresql_using="owner_id::uuid",
        )

        # Check if the foreign key constraint exists before creating it
        existing_fks = inspector.get_foreign_keys("projects")
        if "projects_owner_id_fkey" not in [
            fk["name"] for fk in existing_fks if fk["name"] is not None
        ]:
            op.create_foreign_key(
                constraint_name="projects_owner_id_fkey",
                source_table="projects",
                referent_table="users",
                local_cols=["owner_id"],
                remote_cols=["id"],
            )


def upgrade_7(session):
    """Version 7 upgrade

    This upgrade adds a created column to the imports table
    to provide a timestamp for cleanup operations.

    """

    # Get database connection and metadata
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    imports = metadata.tables.get("imports")

    # Add created column if it doesn't exist
    if imports is not None and "created" not in [col.name for col in imports.columns]:
        op.add_column(
            "imports",
            Column("created", DateTime, default=lambda: datetime.now(timezone.utc), index=True),
        )


def upgrade_8(session):
    """Version 8 upgrade

    This upgrade removes the Report Builder functionality by dropping
    the reports and report_files tables.
    """
    engine = session.connection().engine
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)

    # Drop report_files table first (due to foreign key constraint)
    if "report_files" in metadata.tables:
        op.drop_table("report_files")

    # Drop reports table
    if "reports" in metadata.tables:
        op.drop_table("reports")


def _migrate_filters_to_additional_filters(widget_config, migration_stats, logger):
    """Handle filters -> additional_filters migration for multiple widget types."""
    if (
        widget_config.widget in ["compare-runs-view", "filter-heatmap", "jenkins-job-view"]
        and "filters" in widget_config.params
    ):
        widget_config.params["additional_filters"] = widget_config.params.pop("filters")
        migration_stats["filters_to_additional_filters"] += 1
        logger.debug(
            f"Widget {widget_config.id} ({widget_config.widget}): filters -> additional_filters"
        )
        return True
    return False


def _migrate_filter_to_additional_filters(widget_config, migration_stats, logger):
    """Handle filter -> additional_filters migration for jenkins-job-view."""
    if widget_config.widget == "jenkins-job-view" and "filter" in widget_config.params:
        widget_config.params["additional_filters"] = widget_config.params.pop("filter")
        migration_stats["filter_to_additional_filters"] += 1
        logger.debug(
            f"Widget {widget_config.id} ({widget_config.widget}): filter -> additional_filters"
        )
        return True
    return False


def _migrate_jenkins_job_name(widget_config, migration_stats, logger):
    """Handle jenkins_job_name -> job_name migration for jenkins-heatmap."""
    if widget_config.widget == "jenkins-heatmap" and "jenkins_job_name" in widget_config.params:
        widget_config.params["job_name"] = widget_config.params.pop("jenkins_job_name")
        migration_stats["jenkins_job_name_to_job_name"] += 1
        logger.debug(
            f"Widget {widget_config.id} ({widget_config.widget}): jenkins_job_name -> job_name"
        )
        return True
    return False


def _remove_deprecated_chart_type(widget_config, migration_stats, logger):
    """Remove deprecated chart_type from run-aggregator widgets."""
    if widget_config.widget == "run-aggregator" and "chart_type" in widget_config.params:
        removed_chart_type = widget_config.params.pop("chart_type")
        migration_stats["chart_type_removed"] += 1
        logger.debug(
            f"Widget {widget_config.id} ({widget_config.widget}): removed deprecated "
            f"chart_type='{removed_chart_type}'"
        )
        return True
    return False


def _validate_and_clean_params(widget_config, migration_stats, logger):
    """Validate all parameters against widget type schema and remove invalid ones."""
    if widget_config.widget not in WIDGET_TYPES:
        logger.warning(
            f"Widget {widget_config.id}: unknown widget type '{widget_config.widget}', "
            "skipping parameter validation"
        )
        return False

    valid_param_names = {p["name"] for p in WIDGET_TYPES[widget_config.widget].get("params", [])}
    invalid_params = []

    for param_name in list(widget_config.params.keys()):
        if param_name not in valid_param_names:
            invalid_params.append(param_name)
            widget_config.params.pop(param_name)
            migration_stats["invalid_params_removed"] += 1

    if invalid_params:
        logger.warning(
            f"Widget {widget_config.id} ({widget_config.widget}): removed invalid "
            f"parameters: {invalid_params}"
        )
        return True
    return False


def _migrate_widget_config(widget_config, migration_stats, logger):
    """Migrate a single widget configuration."""
    if not widget_config.params:
        return False

    original_params = widget_config.params.copy()
    params_updated = False

    # Apply all migrations
    params_updated |= _migrate_filters_to_additional_filters(widget_config, migration_stats, logger)
    params_updated |= _migrate_filter_to_additional_filters(widget_config, migration_stats, logger)
    params_updated |= _migrate_jenkins_job_name(widget_config, migration_stats, logger)
    params_updated |= _remove_deprecated_chart_type(widget_config, migration_stats, logger)
    params_updated |= _validate_and_clean_params(widget_config, migration_stats, logger)

    if params_updated:
        migration_stats["widgets_updated"] += 1
        logger.info(
            f"Updated widget {widget_config.id} ({widget_config.widget}): "
            f"{original_params} -> {widget_config.params}"
        )

    return params_updated


def _create_index_safely(op, metadata, table_name, index_name, index_args, logger, indexes_created):
    """Helper function to safely create an index with error handling."""
    table = metadata.tables.get(table_name)
    if table is None or index_name in [idx.name for idx in table.indexes]:
        return False

    try:
        op.create_index(index_name, table_name, **index_args)
        indexes_created.append(index_name)
        logger.info(f"Created index: {index_name}")
        return True
    except Exception as e:
        logger.warning(f"Could not create index {index_name}: {e}")
        # Let the migration framework handle transaction management
        return False


def _check_pg_trgm_extension(session, logger):
    """Check if pg_trgm extension exists, and try to create it if it doesn't.

    Returns True if the extension is available (either already exists or was created),
    False if it cannot be created (e.g., insufficient privileges).
    """
    # First check if the extension already exists
    try:
        result = session.execute(
            text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')")
        )
        extension_exists = result.scalar()
        if extension_exists:
            logger.info("pg_trgm extension already exists")
            return True
    except Exception as e:
        logger.warning(f"Could not check for pg_trgm extension: {e}")
        # Continue to try creating it

    # Try to create the extension if it doesn't exist
    try:
        session.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        logger.info("Enabled pg_trgm extension for pattern matching indexes")
        return True
    except Exception as e:
        logger.warning(
            f"Could not enable pg_trgm extension: {e}. "
            "Trigram indexes will be skipped. "
            "To enable them, a database superuser must run: CREATE EXTENSION pg_trgm;"
        )
        return False


def upgrade_9(session):
    """Version 9 upgrade

    This upgrade migrates existing widget configurations to use validated
    parameter names that match the widget type specifications. It handles:
    - filters -> additional_filters migration for multiple widget types
    - filter -> additional_filters migration for jenkins-job-view
    - jenkins_job_name -> job_name migration for jenkins-heatmap
    - Removal of deprecated chart_type from run-aggregator widgets
    - Validation and cleanup of all parameters against widget type schemas
    """
    logger = logging.getLogger(__name__)

    # Get database connection and metadata

    # Migration statistics for logging
    migration_stats = {
        "filters_to_additional_filters": 0,
        "filter_to_additional_filters": 0,
        "jenkins_job_name_to_job_name": 0,
        "chart_type_removed": 0,
        "invalid_params_removed": 0,
        "widgets_updated": 0,
        "total_widgets_processed": 0,
    }

    # Query all widget configs for comprehensive migration
    widget_configs = session.query(WidgetConfig).all()
    migration_stats["total_widgets_processed"] = len(widget_configs)

    logger.info(f"Starting widget config parameter migration for {len(widget_configs)} widgets")

    # Track widgets that need to be updated to minimize session.add calls
    widgets_to_update = []

    for widget_config in widget_configs:
        if _migrate_widget_config(widget_config, migration_stats, logger):
            widgets_to_update.append(widget_config)

    # Bulk add all updated widgets to session and commit once
    if widgets_to_update:
        for widget_config in widgets_to_update:
            session.add(widget_config)
        session.commit()
        logger.info(f"Committed {len(widgets_to_update)} widget config updates to database")

    # Log final migration statistics
    logger.info("Widget config migration completed successfully:")
    logger.info(f"  Total widgets processed: {migration_stats['total_widgets_processed']}")
    logger.info(f"  Widgets updated: {migration_stats['widgets_updated']}")
    logger.info(
        f"  filters -> additional_filters: {migration_stats['filters_to_additional_filters']}"
    )
    logger.info(
        f"  filter -> additional_filters: {migration_stats['filter_to_additional_filters']}"
    )
    logger.info(
        f"  jenkins_job_name -> job_name: {migration_stats['jenkins_job_name_to_job_name']}"
    )
    logger.info(f"  chart_type removed: {migration_stats['chart_type_removed']}")
    logger.info(f"  Invalid parameters removed: {migration_stats['invalid_params_removed']}")

    print(
        f"upgrade_9 completed: {migration_stats['widgets_updated']}/"
        f"{migration_stats['total_widgets_processed']} widgets updated"
    )


def _get_engine(session, logger):
    """Get the database engine from the session.

    Tries session.bind first (safer, doesn't require active connection),
    then falls back to session.connection().engine.

    :param session: SQLAlchemy session
    :param logger: Logger instance
    :return: Engine instance or None if unable to get engine
    """
    try:
        engine = session.bind
    except AttributeError:
        engine = None

    if engine is not None:
        return engine

    try:
        return session.connection().engine
    except Exception as conn_error:
        logger.error(f"Failed to get engine: {conn_error}")
        return None


@contextmanager
def _raw_autocommit_cursor(engine):
    """Context manager for raw DBAPI cursor with autocommit enabled.

    Provides a cursor in autocommit mode on a fresh connection from the pool,
    ensuring CREATE INDEX CONCURRENTLY can run outside any transaction.
    Manages the cursor lifecycle to eliminate boilerplate in callers.

    :param engine: SQLAlchemy engine
    :yield: DBAPI cursor ready for executing SQL
    """
    # Get a fresh raw connection from the pool
    # This ensures we're not reusing a connection that's in a transaction
    raw_conn = engine.pool.connect()
    try:
        # Get the underlying DBAPI connection
        dbapi_conn = raw_conn.connection
        original_autocommit = getattr(dbapi_conn, "autocommit", False)
        try:
            # Explicitly end any existing transaction
            if not original_autocommit:
                dbapi_conn.rollback()
            # Enable autocommit mode
            dbapi_conn.autocommit = True
            cursor = dbapi_conn.cursor()
            try:
                yield cursor
            finally:
                cursor.close()
        finally:
            # Restore original autocommit state
            if hasattr(dbapi_conn, "autocommit"):
                dbapi_conn.autocommit = original_autocommit
    finally:
        # Return connection to pool
        raw_conn.close()


def _recreate_invalid_index(session, index_name, index_sql, logger):
    """Drop and recreate an index that is in an invalid state.

    :param session: SQLAlchemy session
    :param index_name: Name of the index to recreate
    :param index_sql: SQL statement to create the index
    :param logger: Logger instance
    :return: True if successfully recreated, False on error
    """
    engine = _get_engine(session, logger)
    if engine is None:
        return False

    try:
        with _raw_autocommit_cursor(engine) as cursor:
            cursor.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {index_name}")
            cursor.execute(index_sql)
            logger.info(f"Successfully recreated index: {index_name}")
            return True
    except Exception as drop_error:
        logger.error(f"Failed to recreate index {index_name} after drop attempt: {drop_error}")
        return False


def _create_index_concurrently(session, index_name, index_sql, logger):
    """Create an index concurrently (non-blocking) with proper transaction handling.

    CREATE INDEX CONCURRENTLY cannot be run inside a transaction, so we:
    1. Commit any pending transaction
    2. Use a separate connection with autocommit to create the index outside a transaction
    3. Handle errors gracefully

    Note: CREATE INDEX CONCURRENTLY can take a very long time on large databases
    (potentially hours). The operation is non-blocking for writes but will block
    this connection until complete.

    :param session: SQLAlchemy session
    :param index_name: Name of the index to create
    :param index_sql: SQL statement to create the index (should include CONCURRENTLY)
    :param logger: Logger instance
    :return: True if index was created or already exists, False on error
    """
    logger.info(f"Starting creation of index {index_name} (this may take a while)...")

    # Commit any pending transaction before creating CONCURRENT index
    # CONCURRENT indexes cannot be created inside a transaction
    session.commit()

    engine = _get_engine(session, logger)
    if engine is None:
        logger.error(f"Failed to get engine for index {index_name}")
        return False

    try:
        logger.debug(f"Acquiring autocommit connection for index {index_name}")
        with _raw_autocommit_cursor(engine) as cursor:
            logger.debug(f"Executing CREATE INDEX CONCURRENTLY for {index_name}")
            cursor.execute(index_sql)
            logger.info(f"Successfully created index: {index_name}")
            return True
    except Exception as e:
        error_msg = str(e).lower()
        # Index already exists or is being created concurrently
        if "already exists" in error_msg or "duplicate" in error_msg:
            logger.info(f"Index {index_name} already exists, skipping")
            return True
        # Invalid index name might mean it's in an invalid state from a previous failed attempt
        if "invalid" in error_msg and "name" in error_msg:
            logger.warning(
                f"Index {index_name} may be in invalid state. Attempting to drop and recreate: {e}"
            )
            return _recreate_invalid_index(session, index_name, index_sql, logger)

        logger.error(f"Failed to create index {index_name}: {e}")
        return False


def _create_index_if_missing(session, index_name, index_sql, existing_indexes, logger, stats):
    """Helper to create an index if it doesn't exist, updating stats.

    :param session: SQLAlchemy session
    :param index_name: Name of the index
    :param index_sql: SQL to create the index
    :param existing_indexes: Set of existing index names
    :param logger: Logger instance
    :param stats: Dict with 'created', 'skipped', 'failed' counters
    :return: None
    """
    if index_name not in existing_indexes:
        logger.info(f"Creating index {index_name} (this may take a while on large databases)...")
        success = _create_index_concurrently(session, index_name, index_sql, logger)
        if success:
            stats["created"] += 1
        else:
            stats["failed"] += 1
    else:
        logger.info(f"Index {index_name} already exists, skipping")
        stats["skipped"] += 1


def upgrade_10(session):
    """Version 10 upgrade

    This upgrade adds database indexes to optimize result-aggregator queries
    that group by metadata fields. It adds:

    1. A GIN index on the entire results.data (metadata) column for fast JSONB operations
    2. A composite index on (project_id, start_time) for efficient filtering
    3. A composite index on (project_id, start_time, component) for component-based queries

    These indexes significantly improve performance of queries that:
    - Group by metadata fields (e.g., metadata.assignee, metadata.component)
    - Filter by project_id and time range
    - Aggregate results over time periods

    Note: Uses CREATE INDEX CONCURRENTLY to avoid blocking writes on large production databases.
    This allows the upgrade to complete without causing extended downtime, though index creation
    may take longer. The upgrade is idempotent and can be safely retried if interrupted.

    SQL equivalents:
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_data_gin
            ON results USING gin (data);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_project_start_time
            ON results (project_id, start_time DESC);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_project_start_component
            ON results (project_id, start_time DESC, component);
    """
    logger = logging.getLogger(__name__)
    logger.info("Starting upgrade_10: Adding indexes for result-aggregator optimization")

    try:
        engine = session.connection().engine
        logger.debug("Got database engine, creating upgrade operations")
        get_upgrade_op(session)
        metadata = MetaData()
        logger.debug("Created metadata object, starting reflection...")
        # Suppress warnings about expression-based indexes that SQLAlchemy can't reflect
        with warnings.catch_warnings():
            if SAWarning:
                warnings.filterwarnings(
                    "ignore",
                    category=SAWarning,
                    message=".*Skipped unsupported reflection of expression-based index.*",
                )
            else:
                # Fallback: filter by message pattern if SAWarning is not available
                warnings.filterwarnings(
                    "ignore", message=".*Skipped unsupported reflection of expression-based index.*"
                )
            metadata.reflect(bind=engine)

        if engine.url.get_dialect().name == "postgresql":
            results_table = metadata.tables.get("results")
            if results_table is None:
                logger.warning("Results table not found, skipping index creation")
                logger.info("upgrade_10 skipped: Results table not found")
                return

            existing_indexes = {idx.name for idx in results_table.indexes}
            logger.info(f"Found {len(existing_indexes)} existing indexes on results table")

            stats = {"created": 0, "skipped": 0, "failed": 0}

            # Define indexes to create
            indexes_to_create = [
                (
                    "ix_results_data_gin",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_data_gin "
                    "ON results USING gin (data)",
                ),
                (
                    "ix_results_project_start_time",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_project_start_time "
                    "ON results (project_id, start_time DESC)",
                ),
                (
                    "ix_results_project_start_component",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_results_project_start_component "
                    "ON results (project_id, start_time DESC, component)",
                ),
            ]

            # Create each index if it doesn't exist
            for index_name, index_sql in indexes_to_create:
                _create_index_if_missing(
                    session, index_name, index_sql, existing_indexes, logger, stats
                )

            # Verify indexes were actually created by refreshing metadata
            # This is important because CREATE INDEX CONCURRENTLY can fail silently
            # or the upgrade might have been interrupted
            # Use a fresh MetaData instance to avoid stale index definitions
            verification_metadata = MetaData()
            verification_metadata.reflect(bind=engine, only=["results"])
            results_table = verification_metadata.tables.get("results")
            if results_table is None:
                error_msg = (
                    "upgrade_10 failed: Could not verify index creation - results table "
                    "not found during verification. This indicates a serious database issue. "
                    f"Stats: {stats['created']} created, {stats['skipped']} skipped, "
                    f"{stats['failed']} failed."
                )
                logger.error(error_msg)
                raise OperationalError(error_msg, None, None)

            final_indexes = {idx.name for idx in results_table.indexes}
            missing_indexes = [
                index_name for index_name, _ in indexes_to_create if index_name not in final_indexes
            ]

            if missing_indexes:
                error_msg = (
                    f"upgrade_10 failed: The following indexes were not created: "
                    f"{missing_indexes}. Stats: {stats['created']} created, "
                    f"{stats['skipped']} skipped, {stats['failed']} failed. "
                    "The upgrade can be safely retried."
                )
                logger.error(error_msg)
                # Raise OperationalError so the upgrade framework catches it
                # and doesn't mark as complete. This prevents silent failures where
                # version is updated but indexes aren't created
                raise OperationalError(error_msg, None, None)

            logger.info(
                f"upgrade_10 completed: {stats['created']} indexes created, "
                f"{stats['skipped']} already existed, {stats['failed']} failed"
            )
        else:
            logger.info("upgrade_10 skipped: Not PostgreSQL database")
    except Exception as e:
        logger.error(f"upgrade_10 encountered an error: {e}", exc_info=True)
        # Re-raise as OperationalError so upgrade framework handles it properly
        raise OperationalError(str(e), None, None) from e


def upgrade_11(session):
    """Version 11 upgrade

    This upgrade adds optimized indexes for common widget query patterns to improve performance:

    1. Composite indexes for frequently co-filtered columns:
       - (project_id, start_time) on both runs and results
       - (project_id, component, start_time) on both runs and results
       - (run_id, start_time) on results

    2. GIN indexes on commonly queried JSONB paths:
       - data->'jenkins' on both runs and results (for job_name, build_number)
       - data->'test_suite' on results

    3. GIN indexes for regex/pattern matching (using pg_trgm):
       - component column on both runs and results
       - source column on both runs and results

    4. GIN index on summary JSONB column for aggregation queries

    These indexes target the most common widget query patterns:
    - run-aggregator: filters by project_id, start_time, component with summary aggregations
    - jenkins-heatmap: filters by jenkins.job_name, build_number with component grouping
    - result-aggregator: filters by project_id, run_id, start_time with component grouping
    - filter-heatmap: heavy metadata filtering with component patterns
    """
    logger = logging.getLogger(__name__)
    logger.info("Starting upgrade_11: Adding optimized indexes for common widget query patterns")

    try:
        engine = session.connection().engine
        logger.debug("Got database engine for upgrade_11")
        op = get_upgrade_op(session)
        metadata = MetaData()
        logger.debug("Starting metadata reflection for upgrade_11...")
        # Suppress warnings about expression-based indexes that SQLAlchemy can't reflect
        with warnings.catch_warnings():
            if SAWarning:
                warnings.filterwarnings(
                    "ignore",
                    category=SAWarning,
                    message=".*Skipped unsupported reflection of expression-based index.*",
                )
            else:
                # Fallback: filter by message pattern if SAWarning is not available
                warnings.filterwarnings(
                    "ignore", message=".*Skipped unsupported reflection of expression-based index.*"
                )
            metadata.reflect(bind=engine)

        # Only apply to PostgreSQL (SQLite doesn't support GIN indexes or pg_trgm)
        if engine.url.get_dialect().name != "postgresql":
            logger.info("Skipping upgrade_11: not using PostgreSQL")
            return

        indexes_created = []
        pg_trgm_available = _check_pg_trgm_extension(session, logger)

        # Define and create composite indexes for common query patterns
        composite_indexes = [
            ("runs", "ix_runs_project_id_start_time", ["project_id", "start_time"]),
            ("results", "ix_results_project_id_start_time", ["project_id", "start_time"]),
            (
                "runs",
                "ix_runs_project_component_start_time",
                ["project_id", "component", "start_time"],
            ),
            (
                "results",
                "ix_results_project_component_start_time",
                ["project_id", "component", "start_time"],
            ),
            ("results", "ix_results_run_id_start_time", ["run_id", "start_time"]),
        ]

        for table_name, index_name, columns in composite_indexes:
            _create_index_safely(
                op,
                metadata,
                table_name,
                index_name,
                {"columns": columns},
                logger,
                indexes_created,
            )

        # Define and create GIN indexes for JSONB path queries
        # Use raw SQL for JSONB path expressions to ensure they're treated as
        # expressions, not column names
        jsonb_path_indexes = [
            ("runs", "ix_runs_jenkins", "data->'jenkins'"),
            ("results", "ix_results_jenkins", "data->'jenkins'"),
            ("results", "ix_results_test_suite", "data->'test_suite'"),
        ]

        for table_name, index_name, path_expression in jsonb_path_indexes:
            table = metadata.tables.get(table_name)
            if table is None or index_name in [idx.name for idx in table.indexes]:
                continue

            try:
                # Use raw SQL to create expression indexes on JSONB paths
                connection = session.connection()
                connection.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS {index_name} "
                        f"ON {table_name} USING gin (({path_expression}))"
                    )
                )
                indexes_created.append(index_name)
                logger.info(f"Created GIN JSONB index: {index_name}")
            except Exception as e:
                logger.warning(f"Could not create index {index_name}: {e}")

        # Define and create GIN indexes for pattern matching on text columns
        # These require pg_trgm extension, so only create if extension is available
        if pg_trgm_available:
            pattern_indexes = [
                ("runs", "ix_runs_component_trgm", "component"),
                ("results", "ix_results_component_trgm", "component"),
                ("runs", "ix_runs_source_trgm", "source"),
                ("results", "ix_results_source_trgm", "source"),
            ]

            for table_name, index_name, column_name in pattern_indexes:
                _create_index_safely(
                    op,
                    metadata,
                    table_name,
                    index_name,
                    {
                        "columns": [column_name],
                        "postgresql_using": "gin",
                        "postgresql_ops": {column_name: "gin_trgm_ops"},
                    },
                    logger,
                    indexes_created,
                )
        else:
            logger.info(
                "Skipping trigram indexes (ix_*_component_trgm, ix_*_source_trgm) "
                "because pg_trgm extension is not available"
            )

        # Create GIN index on summary JSONB for aggregation queries
        _create_index_safely(
            op,
            metadata,
            "runs",
            "ix_runs_summary",
            {"columns": ["summary"], "postgresql_using": "gin"},
            logger,
            indexes_created,
        )

        # Log summary
        logger.info(f"upgrade_11 completed: created {len(indexes_created)} indexes")
        if indexes_created:
            logger.info(f"  Indexes created: {', '.join(indexes_created)}")
    except Exception as e:
        logger.error(f"upgrade_11 encountered an error: {e}", exc_info=True)
        # Re-raise as OperationalError so upgrade framework handles it properly
        raise OperationalError(str(e), None, None) from e
