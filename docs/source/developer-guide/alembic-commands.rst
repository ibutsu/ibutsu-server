Alembic Commands Reference
===========================

This document provides a reference for using Alembic database migrations in the Ibutsu Server.

Overview
--------

Alembic is used to manage database schema changes in a version-controlled manner. This replaces the old upgrade system that used ``db.create_all()`` and manual upgrade functions.

Directory Structure
-------------------

.. code-block:: text

   alembic/
   ├── versions/          # Migration scripts
   ├── env.py            # Alembic environment configuration
   ├── script.py.mako    # Template for new migration scripts
   └── README.md         # Documentation

Common Commands
---------------

Generate a new migration
~~~~~~~~~~~~~~~~~~~~~~~~~

After making changes to SQLAlchemy models, generate a migration:

.. code-block:: bash

   alembic revision --autogenerate -m "Description of changes"

Apply migrations
~~~~~~~~~~~~~~~~

To upgrade to the latest version:

.. code-block:: bash

   alembic upgrade head

View migration history
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   alembic history

View current revision
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   alembic current

Downgrade migrations
~~~~~~~~~~~~~~~~~~~~

To downgrade one revision:

.. code-block:: bash

   alembic downgrade -1

To downgrade to a specific revision:

.. code-block:: bash

   alembic downgrade <revision_id>

Initial Setup
-------------

For a new database or when transitioning from the old upgrade system:

1. Ensure the pod is running with the database available
2. Generate the initial baseline migration:

   .. code-block:: bash

      alembic revision --autogenerate -m "Initial baseline"

3. Apply the migration:

   .. code-block:: bash

      alembic upgrade head

Important Notes
---------------

* **Never** use ``db.create_all()`` in production code - it bypasses the migration system
* Always review auto-generated migrations before applying them
* Test migrations in a development environment first
* Migrations should be committed to version control
* Each migration should be atomic and reversible when possible

Integration with Flask
----------------------

The ``env.py`` file integrates Alembic with Flask-SQLAlchemy:

* It loads the Flask app configuration
* Uses the configured database URL
* References the SQLAlchemy metadata from the models

Troubleshooting
---------------

"Target database is not up to date"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This means there are pending migrations. Run ``alembic upgrade head``.

"Can't locate revision identified by 'xyz'"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This may mean the alembic_version table is out of sync. Check the versions directory and the alembic_version table in your database.

Autogenerate detects changes that don't exist
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This can happen with:

* Index naming differences
* Type variations (e.g., VARCHAR vs TEXT)
* Server defaults

Review and edit the generated migration to only include actual changes.

References
----------

* `Alembic Documentation <https://alembic.sqlalchemy.org/>`_
* `Flask-Migrate (alternative approach) <https://flask-migrate.readthedocs.io/>`_
* `SQLAlchemy Documentation <https://docs.sqlalchemy.org/>`_
