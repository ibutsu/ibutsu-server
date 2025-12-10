#!/usr/bin/env python
"""
Database initialization script for development environments.

This script:
1. Creates the initial Alembic migration if it doesn't exist
2. Runs pending migrations
3. Is intended for use in dev/test environments only

For production, migrations should be managed manually.
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


def main():
    """Initialize the database schema using Alembic migrations."""

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    # Get Flask app with database configuration
    flask_app = _AppRegistry.get_alembic_flask_app()

    with flask_app.app_context():
        # Check if database is accessible
        try:
            with db.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✓ Database connection successful")
        except Exception as e:
            logger.error(f"✗ Database connection failed: {e}")
            sys.exit(1)

        # Configure Alembic
        alembic_ini = Path(__file__).parent.parent / "alembic.ini"
        if not alembic_ini.exists():
            logger.error(f"✗ Alembic configuration not found: {alembic_ini}")
            sys.exit(1)

        alembic_cfg = Config(str(alembic_ini))
        script_dir = ScriptDirectory.from_config(alembic_cfg)

        # Check if any migrations exist
        revisions = list(script_dir.walk_revisions())

        if not revisions:
            logger.info("No migrations found. Creating initial baseline migration...")
            try:
                # Generate initial migration
                command.revision(
                    alembic_cfg,
                    autogenerate=True,
                    message="Initial baseline schema",
                )
                logger.info("✓ Initial migration created")
            except Exception as e:
                logger.error(f"✗ Failed to create initial migration: {e}")
                sys.exit(1)

        # Check if alembic_version table exists
        inspector = inspect(db.engine)
        has_alembic_table = "alembic_version" in inspector.get_table_names()

        if not has_alembic_table:
            logger.info("Fresh database detected. Running all migrations...")
        else:
            # Check current database revision
            with db.engine.connect() as conn:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                current = result.scalar()
                if current:
                    logger.info(f"Current database revision: {current}")
                else:
                    logger.info("No revision applied yet")

        # Run migrations
        try:
            logger.info("Running migrations...")
            command.upgrade(alembic_cfg, "head")
            logger.info("✓ Database migrations completed successfully")

            # Show current revision
            with db.engine.connect() as conn:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                current = result.scalar()
                if current:
                    logger.info(f"✓ Database is now at revision: {current}")

        except Exception as e:
            logger.error(f"✗ Migration failed: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
