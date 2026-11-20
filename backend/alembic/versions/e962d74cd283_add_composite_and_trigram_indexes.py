"""add composite and trigram indexes for slow queries

Revision ID: e962d74cd283
Revises: c4d5e6f7a8b9
Create Date: 2026-10-19 19:34:42.734685

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e962d74cd283"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def _is_postgresql() -> bool:
    """Return True when this command is aimed at PostgreSQL."""
    bind = op.get_bind()
    if bind:
        return bind.dialect.name == "postgresql"
    return op.get_context().dialect.name == "postgresql"


def _is_offline() -> bool:
    """Return True when Alembic is writing SQL instead of talking to a database."""
    return bool(getattr(op.get_context(), "as_sql", False))


def _trgm_indexes_remain() -> bool:
    """Return True when some index still uses the trigram operator class."""
    bind = op.get_bind()
    if bind is None or _is_offline():
        return False
    row = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_index AS i
            JOIN pg_opclass AS oc ON oc.oid = ANY (i.indclass)
            WHERE oc.opcname = 'gin_trgm_ops'
            LIMIT 1
            """
        )
    ).fetchone()
    return row is not None


_INVALID_INDEX_SQL = sa.text(
    """
    SELECT i.indisvalid
    FROM pg_index AS i
    JOIN pg_class AS c ON c.oid = i.indexrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE c.relname = :index_name
      AND n.nspname = current_schema()
    """
)


def _drop_invalid_index(index_name: str, table_name: str) -> None:
    """Drop an index left invalid by an interrupted concurrent build."""
    bind = op.get_bind()
    if bind is None or _is_offline():
        return
    row = bind.execute(_INVALID_INDEX_SQL, {"index_name": index_name}).fetchone()
    if row and not row[0]:
        op.drop_index(
            index_name,
            table_name=table_name,
            postgresql_concurrently=True,
            if_exists=True,
        )


def upgrade() -> None:
    if not _is_postgresql():
        return

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    # autocommit_block commits the migration transaction, runs these
    # statements one by one, and each one is saved immediately.
    with op.get_context().autocommit_block():
        _drop_invalid_index("ix_runs_project_id_start_time", "runs")
        op.create_index(
            "ix_runs_project_id_start_time",
            "runs",
            ["project_id", sa.text("start_time DESC")],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        _drop_invalid_index("ix_results_test_id_start_time", "results")
        op.create_index(
            "ix_results_test_id_start_time",
            "results",
            ["test_id", sa.text("start_time DESC")],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        # pg_trgm splits text into three-letter pieces. gin_trgm_ops stores
        # those pieces so a middle-of-string search on source, component,
        # or test_id does not have to read the whole table.
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        _drop_invalid_index("ix_runs_source_trgm", "runs")
        op.create_index(
            "ix_runs_source_trgm",
            "runs",
            ["source"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"source": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        _drop_invalid_index("ix_runs_component_trgm", "runs")
        op.create_index(
            "ix_runs_component_trgm",
            "runs",
            ["component"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"component": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        _drop_invalid_index("ix_results_test_id_trgm", "results")
        op.create_index(
            "ix_results_test_id_trgm",
            "results",
            ["test_id"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"test_id": "gin_trgm_ops"},
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    if not _is_postgresql():
        return

    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_results_test_id_trgm",
            table_name="results",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_component_trgm",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_source_trgm",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
        if not _trgm_indexes_remain():
            op.execute("DROP EXTENSION IF EXISTS pg_trgm")
        op.drop_index(
            "ix_results_test_id_start_time",
            table_name="results",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.drop_index(
            "ix_runs_project_id_start_time",
            table_name="runs",
            postgresql_concurrently=True,
            if_exists=True,
        )
