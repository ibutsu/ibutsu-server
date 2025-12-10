#!/usr/bin/env python
"""
Database initialization script for development environments.

This script:
1. Applies existing Alembic migrations to the database
2. Is intended for use in dev/test environments only

For production, migrations should be managed manually.

IMPORTANT: This script does NOT create new migration files.
Migration files should be created manually using:
    alembic revision --autogenerate -m "description"
and committed to version control.
"""

import logging
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from alembic import command
from ibutsu_server import _AppRegistry
from ibutsu_server.db.base import db

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def initialize_flask_app(logger):
    """Initialize and return the Flask app with database configuration."""
    try:
        return _AppRegistry.get_alembic_flask_app()
    except Exception as e:
        logger.error(f"✗ Failed to initialize Flask app: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)


def check_database_connection(logger):
    """Verify database connectivity."""
    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✓ Database connection successful")
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)


def load_alembic_config(logger):
    """Load and return Alembic configuration and script directory."""
    alembic_ini = Path(__file__).parent.parent / "alembic.ini"
    if not alembic_ini.exists():
        logger.error(f"✗ Alembic configuration not found: {alembic_ini}")
        sys.exit(1)

    try:
        alembic_cfg = Config(str(alembic_ini))
        script_dir = ScriptDirectory.from_config(alembic_cfg)
        return alembic_cfg, script_dir
    except Exception as e:
        logger.error(f"✗ Failed to load Alembic configuration: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)


def get_migration_revisions(script_dir, logger):
    """Get and validate migration revisions."""
    try:
        revisions = list(script_dir.walk_revisions())
    except Exception as e:
        logger.error(f"✗ Failed to read migrations: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)

    if not revisions:
        logger.error("✗ No migrations found in alembic/versions/")
        logger.error("Please create an initial migration manually:")
        logger.error("  1. Ensure your models are up to date")
        logger.error("  2. Run: alembic revision --autogenerate -m 'Initial baseline schema'")
        logger.error("  3. Review the generated migration file")
        logger.error("  4. Commit it to version control")
        logger.error("  5. Re-run this script")
        sys.exit(1)

    logger.info(f"Found {len(revisions)} migration(s) in alembic/versions/")
    return revisions


def check_database_state(logger):
    """Check and log the current database migration state."""
    try:
        inspector = inspect(db.engine)
        has_alembic_table = "alembic_version" in inspector.get_table_names()
    except Exception as e:
        logger.error(f"✗ Failed to inspect database: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)

    if not has_alembic_table:
        logger.info("Fresh database detected. Running all migrations...")
        return

    # Check current database revision
    try:
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.scalar()
            if current:
                logger.info(f"Current database revision: {current}")
            else:
                logger.info("No revision applied yet")
    except Exception as e:
        logger.warning(f"Could not read current revision: {e}")


def apply_migrations(alembic_cfg, logger):
    """Apply database migrations."""
    try:
        logger.info("Applying migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("✓ Database migrations completed successfully")

        # Show current revision
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.scalar()
            if current:
                logger.info(f"✓ Database is now at revision: {current}")
            else:
                logger.warning("⚠ No revision recorded (this is unexpected)")

    except Exception as e:
        logger.error(f"✗ Migration failed: {e}")
        logger.exception("Full traceback:")
        logger.error("")
        logger.error("Troubleshooting tips:")
        logger.error("  1. Check if the migration files are valid Python")
        logger.error("  2. Ensure the database schema matches the expected state")
        logger.error("  3. Try running migrations manually: alembic upgrade head")
        logger.error("  4. Check for circular dependencies in the models")
        sys.exit(1)


def main():
    """Initialize the database schema using Alembic migrations."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    logger = logging.getLogger(__name__)

    flask_app = initialize_flask_app(logger)

    with flask_app.app_context():
        check_database_connection(logger)
        alembic_cfg, script_dir = load_alembic_config(logger)
        get_migration_revisions(script_dir, logger)
        check_database_state(logger)
        apply_migrations(alembic_cfg, logger)


if __name__ == "__main__":
    main()
