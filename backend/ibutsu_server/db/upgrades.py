import logging
from datetime import datetime, timezone

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import MetaData, inspect
from sqlalchemy.sql import quoted_name
from sqlalchemy.sql.expression import null

# Merge both: keep imports from HEAD + add db from incoming
from ibutsu_server.constants import WIDGET_TYPES
from ibutsu_server.db.base import Boolean, Column, DateTime, ForeignKey, Text, db
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.db.types import PortableUUID

__version__ = 9


def get_upgrade_op(current_session):
    """
    Create a migration context and an operations object for performing upgrades.

    :param current_session: The SQLAlchemy current_session object.
    """
    bind = getattr(current_session, "bind", None) or db.engine
    context = MigrationContext.configure(bind.connect())
    return Operations(context)


def upgrade_1(current_session):
    """Version 1 upgrade

    This upgrade adds a dashboard_id to the widget_configs table
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
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


def upgrade_2(current_session):
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

    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
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


def upgrade_3(current_session):
    """Version 3 upgrade

    This upgrade:
        - makes the 'result_id' column of artifacts nullable
        - adds a 'run_id' to the artifacts table
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
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


def upgrade_4(current_session):
    """Version 4 upgrade

    This upgrade removes the "nullable" constraint on the password field, and adds a "is_superadmin"
    field to the user table.
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
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


def upgrade_5(current_session):
    """Version 5 upgrade

    This upgrade adds a default dashboard to a project
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
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


def upgrade_6(current_session):
    """Version 6 upgrade

    This upgrade repairs broken field types on tables not matching schema

    Investigating the failure of the controllers.admin.user_controller.admin_delete_user function
    it was found that the Project.owner_id field in the stage and prod database are TEXT instead of
    PortableUUID.
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)

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
    engine = getattr(session, "bind", None) or db.engine
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
    widget_configs = session.execute(db.select(WidgetConfig)).scalars().all()
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
