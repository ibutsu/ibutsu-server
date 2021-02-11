from alembic.migration import MigrationContext
from alembic.operations import Operations
from ibutsu_server.db.base import Column
from ibutsu_server.db.base import ForeignKey
from ibutsu_server.db.types import PortableUUID
from sqlalchemy import MetaData
from sqlalchemy.sql import quoted_name
from sqlalchemy.sql.expression import null

__version__ = 2


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
        and not widget_configs.columns.contains_column("dashboard_id")
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

    if engine.url.get_dialect().name == "postgresql":
        for table in TABLES:
            op.create_index(
                f"ix_{table}_tags",
                table,
                [quoted_name("(data->'tags')", False)],
                postgresql_using="gin",
            )
            if table == "results":
                op.create_index(
                    f"ix_{table}_requirements",
                    table,
                    [quoted_name("(data->'requirements')", False)],
                    postgresql_using="gin",
                )
