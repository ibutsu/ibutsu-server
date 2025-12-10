"""Alembic environment configuration for Flask-SQLAlchemy integration.

This module configures Alembic to work with Flask-SQLAlchemy models.
It supports both offline (SQL script generation) and online (direct database) modes.
"""

import logging
from logging.config import fileConfig

from alembic import context
from ibutsu_server import _AppRegistry

# Import the Flask app and database
from ibutsu_server.db.base import db

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# Get lightweight Flask app for Alembic migrations
# This skips runtime initialization (Mail, superadmin creation) to avoid side effects
flask_app = _AppRegistry.get_alembic_flask_app()

# Set the SQLAlchemy URL from Flask app config
with flask_app.app_context():
    config.set_main_option("sqlalchemy.url", str(db.engine.url).replace("%", "%%"))

target_metadata = db.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    # Use the engine from Flask-SQLAlchemy within app context
    with flask_app.app_context():
        connectable = db.engine

        with connectable.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)

            with context.begin_transaction():
                context.run_migrations()


if context.is_offline_mode():
    logger.info("Running migrations in offline mode")
    run_migrations_offline()
else:
    logger.info("Running migrations in online mode")
    run_migrations_online()
