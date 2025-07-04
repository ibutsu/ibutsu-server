from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import MetaData
from sqlalchemy.sql import quoted_name
from sqlalchemy.sql.expression import null

from ibutsu_server.db.base import Boolean, Column, ForeignKey, Text, db
from ibutsu_server.db.types import PortableUUID

__version__ = 6


def get_upgrade_op(current_session):
    """
    Create a migration context and an operations object for performing upgrades.

    :param current_session: The SQLAlchemy current_session object.
    """
    # Flask-SQLAlchemy 3.0+ compatibility: use db.engine instead of current_session.get_bind()
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

    This upgrade adds optimized database indexes for widget queries to improve performance.
    These indexes target the most common query patterns used by widget endpoints:
    - Widget configs by project and dashboard
    - Results filtering by project, outcome, start_time
    - Runs filtering by project, summary, start_time
    - Artifacts by result/run relationships

    The indexes are database-specific:
    - PostgreSQL: Uses GIN indexes for JSONB data and B-tree for other columns
    - MySQL: Uses standard indexes with appropriate key lengths
    - SQLite: Uses simple indexes without advanced features
    """
    engine = getattr(current_session, "bind", None) or db.engine
    op = get_upgrade_op(current_session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    dialect = engine.url.get_dialect().name

    # Define indexes to create based on widget query analysis
    indexes_to_create = []

    # Widget Configs indexes
    if "widget_configs" in metadata.tables:
        widget_configs = metadata.tables["widget_configs"]
        existing_indexes = {idx.name for idx in widget_configs.indexes}

        # Composite index for project + dashboard filtering
        if "ix_widget_configs_project_dashboard" not in existing_indexes:
            indexes_to_create.append(
                {
                    "name": "ix_widget_configs_project_dashboard",
                    "table": "widget_configs",
                    "columns": ["project_id", "dashboard_id"],
                }
            )

        # Project-only index for queries without dashboard filter
        if "ix_widget_configs_project_id" not in existing_indexes:
            indexes_to_create.append(
                {
                    "name": "ix_widget_configs_project_id",
                    "table": "widget_configs",
                    "columns": ["project_id"],
                }
            )

    # Results indexes
    if "results" in metadata.tables:
        results = metadata.tables["results"]
        existing_indexes = {idx.name for idx in results.indexes}

        # Composite index for common result filtering
        if "ix_results_project_result_start" not in existing_indexes:
            indexes_to_create.append(
                {
                    "name": "ix_results_project_result_start",
                    "table": "results",
                    "columns": ["project_id", "result", "start_time"],
                }
            )

        # Index for time-based queries
        if "ix_results_start_time" not in existing_indexes:
            indexes_to_create.append(
                {"name": "ix_results_start_time", "table": "results", "columns": ["start_time"]}
            )

        # Index for run relationship lookups
        if "ix_results_run_id" not in existing_indexes:
            indexes_to_create.append(
                {"name": "ix_results_run_id", "table": "results", "columns": ["run_id"]}
            )

    # Runs indexes
    if "runs" in metadata.tables:
        runs = metadata.tables["runs"]
        existing_indexes = {idx.name for idx in runs.indexes}

        # Composite index for run filtering
        if "ix_runs_project_summary_start" not in existing_indexes:
            indexes_to_create.append(
                {
                    "name": "ix_runs_project_summary_start",
                    "table": "runs",
                    "columns": ["project_id", "summary", "start_time"],
                }
            )

        # Time-based index for runs
        if "ix_runs_start_time" not in existing_indexes:
            indexes_to_create.append(
                {"name": "ix_runs_start_time", "table": "runs", "columns": ["start_time"]}
            )

    # Artifacts indexes
    if "artifacts" in metadata.tables:
        artifacts = metadata.tables["artifacts"]
        existing_indexes = {idx.name for idx in artifacts.indexes}

        # Index for result relationship lookups
        if "ix_artifacts_result_id" not in existing_indexes:
            indexes_to_create.append(
                {"name": "ix_artifacts_result_id", "table": "artifacts", "columns": ["result_id"]}
            )

        # Index for run relationship lookups
        if "ix_artifacts_run_id" not in existing_indexes:
            indexes_to_create.append(
                {"name": "ix_artifacts_run_id", "table": "artifacts", "columns": ["run_id"]}
            )

    # Create the indexes
    for index_spec in indexes_to_create:
        try:
            if dialect == "postgresql":
                # PostgreSQL can use concurrent index creation, but skip for migrations
                op.create_index(index_spec["name"], index_spec["table"], index_spec["columns"])
            elif dialect == "mysql":
                # MySQL with appropriate key lengths for text columns
                columns = []
                for col in index_spec["columns"]:
                    if col in ["summary"]:  # Text columns that might be long
                        columns.append(quoted_name(f"{col}(255)", False))
                    else:
                        columns.append(col)
                op.create_index(index_spec["name"], index_spec["table"], columns)
            else:
                # SQLite and other databases - simple indexes
                op.create_index(index_spec["name"], index_spec["table"], index_spec["columns"])
        except Exception as e:
            # Continue if index already exists or other non-critical error
            if "already exists" not in str(e).lower():
                print(f"Warning: Could not create index {index_spec['name']}: {e}")
