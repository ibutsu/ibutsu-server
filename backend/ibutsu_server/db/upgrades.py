from alembic.migration import MigrationContext
from alembic.operations import Operations
from ibutsu_server.db.base import Boolean
from ibutsu_server.db.base import Column
from ibutsu_server.db.base import ForeignKey
from ibutsu_server.db.base import Text
from ibutsu_server.db.types import PortableUUID
from sqlalchemy import MetaData
from sqlalchemy.sql import quoted_name
from sqlalchemy.sql.expression import null

__version__ = 5


def get_upgrade_op(session):
    """
    Create a migration context and an operations object for performing upgrades.

    :param session: The SQLAlchemy session object.
    """
    context = MigrationContext.configure(session.get_bind().connect())
    return Operations(context)


def upgrade_1(session):
    """Version 1 upgrade

    This upgrade adds a dashboard_id to the widget_configs table
    """
    engine = session.get_bind()
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    widget_configs = metadata.tables.get("widget_configs")
    if (
        "dashboards" in metadata.tables
        and widget_configs is not None
        and "dashboard_id" not in [col.name for col in widget_configs.columns]
    ):
        op.add_column("widget_configs", Column("dashboard_id", PortableUUID, server_default=null()))
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

    engine = session.get_bind()
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
    engine = session.get_bind()
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
    engine = session.get_bind()
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
    engine = session.get_bind()
    op = get_upgrade_op(session)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    projects = metadata.tables.get("projects")

    if (
        "projects" in metadata.tables
        and projects is not None
        and "default_dashboard_id" not in [col.name for col in projects.columns]
    ):
        op.add_column("projects", Column(PortableUUID(), ForeignKey("dashboards.id")))
