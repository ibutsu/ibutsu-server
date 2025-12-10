"""Initial baseline schema

Revision ID: cacecc4f1237
Revises:
Create Date: 2025-12-10 17:25:54.628543

"""

import sqlalchemy as sa

from alembic import op
from ibutsu_server.db.types import PortableJSON, PortableUUID

# revision identifiers, used by Alembic.
revision = "cacecc4f1237"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create groups table
    op.create_table(
        "groups",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("data", PortableJSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_groups_name"), "groups", ["name"], unique=False)

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("_password", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("activation_code", sa.Text(), nullable=True),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("group_id", PortableUUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_group_id"), "users", ["group_id"], unique=False)

    # Create dashboards table (without project_id FK initially due to circular dependency)
    op.create_table(
        "dashboards",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("filters", sa.Text(), nullable=True),
        sa.Column("project_id", PortableUUID(), nullable=True),
        sa.Column("user_id", PortableUUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_dashboards_project_id"), "dashboards", ["project_id"], unique=False)
    op.create_index(op.f("ix_dashboards_title"), "dashboards", ["title"], unique=False)
    op.create_index(op.f("ix_dashboards_user_id"), "dashboards", ["user_id"], unique=False)

    # Create projects table (without default_dashboard_id FK initially)
    op.create_table(
        "projects",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("owner_id", PortableUUID(), nullable=True),
        sa.Column("group_id", PortableUUID(), nullable=True),
        sa.Column("default_dashboard_id", PortableUUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_projects_group_id"), "projects", ["group_id"], unique=False)
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=False)
    op.create_index(op.f("ix_projects_owner_id"), "projects", ["owner_id"], unique=False)
    op.create_index(op.f("ix_projects_title"), "projects", ["title"], unique=False)

    # Now add the foreign key constraints to handle circular dependency
    op.create_foreign_key(
        "fk_dashboards_project_id", "dashboards", "projects", ["project_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_project_default_dashboard",
        "projects",
        "dashboards",
        ["default_dashboard_id"],
        ["id"],
        use_alter=True,
    )

    # Create widget_configs table
    op.create_table(
        "widget_configs",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("project_id", PortableUUID(), nullable=True),
        sa.Column("dashboard_id", PortableUUID(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("type", sa.Text(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("widget", sa.Text(), nullable=True),
        sa.Column("params", PortableJSON(), nullable=True),
        sa.Column("navigable", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dashboard_id"],
            ["dashboards.id"],
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(
        op.f("ix_widget_configs_dashboard_id"), "widget_configs", ["dashboard_id"], unique=False
    )
    op.create_index(
        op.f("ix_widget_configs_navigable"), "widget_configs", ["navigable"], unique=False
    )
    op.create_index(
        op.f("ix_widget_configs_project_id"), "widget_configs", ["project_id"], unique=False
    )
    op.create_index(op.f("ix_widget_configs_title"), "widget_configs", ["title"], unique=False)
    op.create_index(op.f("ix_widget_configs_type"), "widget_configs", ["type"], unique=False)
    op.create_index(op.f("ix_widget_configs_weight"), "widget_configs", ["weight"], unique=False)
    op.create_index(op.f("ix_widget_configs_widget"), "widget_configs", ["widget"], unique=False)

    # Create imports table
    op.create_table(
        "imports",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=True),
        sa.Column("format", sa.Text(), nullable=True),
        sa.Column("data", PortableJSON(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("created", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_imports_created"), "imports", ["created"], unique=False)
    op.create_index(op.f("ix_imports_filename"), "imports", ["filename"], unique=False)
    op.create_index(op.f("ix_imports_format"), "imports", ["format"], unique=False)
    op.create_index(op.f("ix_imports_status"), "imports", ["status"], unique=False)

    # Create import_files table
    op.create_table(
        "import_files",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("import_id", PortableUUID(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=True),
        sa.ForeignKeyConstraint(
            ["import_id"],
            ["imports.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_import_files_import_id"), "import_files", ["import_id"], unique=False)

    # Create runs table
    op.create_table(
        "runs",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("project_id", PortableUUID(), nullable=True),
        sa.Column("data", PortableJSON(), nullable=True),
        sa.Column("env", sa.Text(), nullable=True),
        sa.Column("component", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("summary", PortableJSON(), nullable=True),
        sa.Column("created", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_runs_component"), "runs", ["component"], unique=False)
    op.create_index(op.f("ix_runs_created"), "runs", ["created"], unique=False)
    op.create_index(op.f("ix_runs_duration"), "runs", ["duration"], unique=False)
    op.create_index(op.f("ix_runs_env"), "runs", ["env"], unique=False)
    op.create_index(op.f("ix_runs_project_id"), "runs", ["project_id"], unique=False)
    op.create_index(op.f("ix_runs_source"), "runs", ["source"], unique=False)
    op.create_index(op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False)

    # Create results table
    op.create_table(
        "results",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("project_id", PortableUUID(), nullable=True),
        sa.Column("run_id", PortableUUID(), nullable=True),
        sa.Column("test_id", sa.Text(), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("data", PortableJSON(), nullable=True),
        sa.Column("params", PortableJSON(), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("env", sa.Text(), nullable=True),
        sa.Column("component", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_results_component"), "results", ["component"], unique=False)
    op.create_index(op.f("ix_results_duration"), "results", ["duration"], unique=False)
    op.create_index(op.f("ix_results_env"), "results", ["env"], unique=False)
    op.create_index(op.f("ix_results_project_id"), "results", ["project_id"], unique=False)
    op.create_index(op.f("ix_results_result"), "results", ["result"], unique=False)
    op.create_index(op.f("ix_results_run_id"), "results", ["run_id"], unique=False)
    op.create_index(op.f("ix_results_source"), "results", ["source"], unique=False)
    op.create_index(op.f("ix_results_start_time"), "results", ["start_time"], unique=False)
    op.create_index(op.f("ix_results_test_id"), "results", ["test_id"], unique=False)

    # Create artifacts table
    op.create_table(
        "artifacts",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=True),
        sa.Column("result_id", PortableUUID(), nullable=True),
        sa.Column("run_id", PortableUUID(), nullable=True),
        sa.Column("filename", sa.Text(), nullable=True),
        sa.Column("data", PortableJSON(), nullable=True),
        sa.Column("upload_date", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["result_id"],
            ["results.id"],
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_artifacts_filename"), "artifacts", ["filename"], unique=False)
    op.create_index(op.f("ix_artifacts_result_id"), "artifacts", ["result_id"], unique=False)
    op.create_index(op.f("ix_artifacts_run_id"), "artifacts", ["run_id"], unique=False)
    op.create_index(op.f("ix_artifacts_upload_date"), "artifacts", ["upload_date"], unique=False)

    # Create tokens table
    op.create_table(
        "tokens",
        sa.Column("id", PortableUUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires", sa.DateTime(), nullable=True),
        sa.Column("user_id", PortableUUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(op.f("ix_tokens_user_id"), "tokens", ["user_id"], unique=False)

    # Create meta table
    op.create_table(
        "meta",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index(op.f("ix_meta_key"), "meta", ["key"], unique=False)

    # Create users_projects association table
    op.create_table(
        "users_projects",
        sa.Column("user_id", PortableUUID(), nullable=False),
        sa.Column("project_id", PortableUUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("user_id", "project_id"),
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("users_projects")
    op.drop_index(op.f("ix_meta_key"), table_name="meta")
    op.drop_table("meta")
    op.drop_index(op.f("ix_tokens_user_id"), table_name="tokens")
    op.drop_table("tokens")
    op.drop_index(op.f("ix_artifacts_upload_date"), table_name="artifacts")
    op.drop_index(op.f("ix_artifacts_run_id"), table_name="artifacts")
    op.drop_index(op.f("ix_artifacts_result_id"), table_name="artifacts")
    op.drop_index(op.f("ix_artifacts_filename"), table_name="artifacts")
    op.drop_table("artifacts")
    op.drop_index(op.f("ix_results_test_id"), table_name="results")
    op.drop_index(op.f("ix_results_start_time"), table_name="results")
    op.drop_index(op.f("ix_results_source"), table_name="results")
    op.drop_index(op.f("ix_results_run_id"), table_name="results")
    op.drop_index(op.f("ix_results_result"), table_name="results")
    op.drop_index(op.f("ix_results_project_id"), table_name="results")
    op.drop_index(op.f("ix_results_env"), table_name="results")
    op.drop_index(op.f("ix_results_duration"), table_name="results")
    op.drop_index(op.f("ix_results_component"), table_name="results")
    op.drop_table("results")
    op.drop_index(op.f("ix_runs_start_time"), table_name="runs")
    op.drop_index(op.f("ix_runs_source"), table_name="runs")
    op.drop_index(op.f("ix_runs_project_id"), table_name="runs")
    op.drop_index(op.f("ix_runs_env"), table_name="runs")
    op.drop_index(op.f("ix_runs_duration"), table_name="runs")
    op.drop_index(op.f("ix_runs_created"), table_name="runs")
    op.drop_index(op.f("ix_runs_component"), table_name="runs")
    op.drop_table("runs")
    op.drop_index(op.f("ix_import_files_import_id"), table_name="import_files")
    op.drop_table("import_files")
    op.drop_index(op.f("ix_imports_status"), table_name="imports")
    op.drop_index(op.f("ix_imports_format"), table_name="imports")
    op.drop_index(op.f("ix_imports_filename"), table_name="imports")
    op.drop_index(op.f("ix_imports_created"), table_name="imports")
    op.drop_table("imports")
    op.drop_index(op.f("ix_widget_configs_widget"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_weight"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_type"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_title"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_project_id"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_navigable"), table_name="widget_configs")
    op.drop_index(op.f("ix_widget_configs_dashboard_id"), table_name="widget_configs")
    op.drop_table("widget_configs")

    # Drop circular FK constraints before dropping tables
    op.drop_constraint("fk_project_default_dashboard", "projects", type_="foreignkey")
    op.drop_constraint("fk_dashboards_project_id", "dashboards", type_="foreignkey")

    op.drop_index(op.f("ix_projects_title"), table_name="projects")
    op.drop_index(op.f("ix_projects_owner_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_name"), table_name="projects")
    op.drop_index(op.f("ix_projects_group_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_dashboards_user_id"), table_name="dashboards")
    op.drop_index(op.f("ix_dashboards_title"), table_name="dashboards")
    op.drop_index(op.f("ix_dashboards_project_id"), table_name="dashboards")
    op.drop_table("dashboards")
    op.drop_index(op.f("ix_users_group_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_groups_name"), table_name="groups")
    op.drop_table("groups")
