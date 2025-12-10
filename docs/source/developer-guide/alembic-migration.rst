Migration to Alembic
====================

Overview
--------

The ibutsu-server backend has been refactored to use Alembic for database schema management, replacing the previous custom upgrade system.

Changes Made
------------

Removed Old Upgrade System
~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Deleted:**

* ``ibutsu_server/db/upgrades.py`` - contained upgrade functions 1-9

**Removed from ``ibutsu_server/__init__.py``:**

* Import of ``upgrades`` module
* Import of ``upgrade_db`` function
* Call to ``db.create_all()`` (dangerous in production)
* Call to ``upgrade_db(db.session, upgrades)``

**Removed from ``ibutsu_server/db/models.py``:**

* ``upgrade_db()`` function definition

**Updated tests:**

* Removed mocks for ``db.create_all()`` and ``upgrade_db()`` from ``tests/test_init.py``

Added Alembic Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Created the following files in ``backend/``:

.. code-block:: text

   backend/
   ├── alembic.ini                    # Alembic configuration
   └── alembic/
       ├── env.py                     # Flask-SQLAlchemy integration
       ├── script.py.mako             # Migration template
       ├── README.md                  # Documentation
       └── versions/                  # Migration scripts directory
           └── .gitkeep

Next Steps: Creating the Initial Migration
-------------------------------------------

After the local development pod is started with:

.. code-block:: bash

   ./scripts/ibutsu-pod.sh -d -v -p -a

Step 1: Access the Pod
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   podman exec -it ibutsu-postgres bash

Step 2: Navigate to Backend Directory
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   cd /path/to/backend  # Adjust based on pod mount

Step 3: Generate Initial Baseline Migration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This will create a migration that captures the current database schema:

.. code-block:: bash

   alembic revision --autogenerate -m "Initial baseline"

This command will:

* Inspect all SQLAlchemy models in ``ibutsu_server/db/models.py``
* Compare with the current database state
* Generate a migration file in ``alembic/versions/``

Step 4: Review the Generated Migration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Open the generated file in ``alembic/versions/`` and review:

* Ensure all tables are included
* Check for any unexpected changes
* Verify index and constraint definitions

Step 5: Apply the Migration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   alembic upgrade head

Step 6: Verify Migration
~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   alembic current

Should show the revision ID of your initial baseline.

Important Notes
---------------

Database Schema Management
~~~~~~~~~~~~~~~~~~~~~~~~~~

* **Never use ``db.create_all()``** - It bypasses migrations and is dangerous in production
* **Always use Alembic** for schema changes
* **Test migrations** in development before applying to production

The Meta Table
~~~~~~~~~~~~~~

The ``Meta`` model (table: ``meta``) is still present in the codebase but is no longer used for version tracking. Alembic uses its own ``alembic_version`` table for tracking applied migrations.

Old Upgrade History
~~~~~~~~~~~~~~~~~~~

The previous upgrade system had 9 upgrade functions that performed:

1. Added dashboard_id to widget_configs
2. Added GIN indices for tags and requirements
3. Made result_id nullable in artifacts, added run_id
4. Added is_superadmin, is_active, activation_code to users
5. Added default_dashboard_id to projects
6. Fixed owner_id type in projects table
7. Added created column to imports table
8. Dropped reports and report_files tables
9. Migrated widget config parameters

These changes should already be reflected in your database schema. The initial baseline migration will capture the current state.

Future Workflow
---------------

Making Schema Changes
~~~~~~~~~~~~~~~~~~~~~

1. Modify SQLAlchemy models in ``ibutsu_server/db/models.py``
2. Generate migration: ``alembic revision --autogenerate -m "Description"``
3. Review and edit the generated migration if needed
4. Test the migration: ``alembic upgrade head``
5. Commit the migration file to git

Applying Migrations in Production
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Deploy new code with migration files
2. Run ``alembic upgrade head`` before starting the application
3. Start the application

Troubleshooting
---------------

"Can't locate revision"
~~~~~~~~~~~~~~~~~~~~~~~

The alembic_version table may be missing or out of sync. This is expected on first setup.

Autogenerate detects unwanted changes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Review the migration and remove any changes that are:

* Type variations (VARCHAR vs TEXT)
* Index naming differences
* Unchanged server defaults

Need to rollback
~~~~~~~~~~~~~~~~

.. code-block:: bash

   alembic downgrade -1  # Go back one revision

References
----------

* `Alembic Documentation <https://alembic.sqlalchemy.org/>`_
* `Flask-SQLAlchemy <https://flask-sqlalchemy.palletsprojects.com/>`_
* Backend README: ``ibutsu-server/backend/README.md``
* Alembic README: ``alembic/README.md``
