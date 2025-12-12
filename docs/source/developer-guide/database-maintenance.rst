Database Maintenance
====================

This guide covers database maintenance tasks for Ibutsu, including cleanup policies, vacuum operations, and storage optimization.

Cleanup Tasks
-------------

Ibutsu uses Celery Beat scheduled tasks to automatically clean up old data from the database. These tasks help manage database size and performance.

Import Files Cleanup
~~~~~~~~~~~~~~~~~~~~

**Task:** ``prune_old_import_files``

**Schedule:** Daily at 2 AM

**Default Retention:** 7 days

Import files contain the raw uploaded content (JUnit XML, tar.gz archives) which can be large. After the import task completes, the file content is automatically cleared to save space, but the import record is kept for audit purposes. This cleanup task removes both the import records and their associated files after the retention period.

**Configuration:**

The retention period can be adjusted in ``celery_utils.py``:

.. code-block:: python

   "prune-old-import-files": {
       "task": "ibutsu_server.tasks.db.prune_old_import_files",
       "schedule": crontab(minute=0, hour=2),  # 2 am daily
       "args": (7,),  # delete any import files older than 7 days
   }

**Storage Optimization:**

After an import completes successfully, the ``clear_import_file_content`` task automatically clears the binary content from the ``import_files`` table while keeping the import record for history. This significantly reduces database storage requirements.

Artifact Files Cleanup
~~~~~~~~~~~~~~~~~~~~~~

**Task:** ``prune_old_files``

**Schedule:** Weekly on Saturday at 4 AM

**Default Retention:** 3 months

Deletes artifact files (test logs, screenshots, etc.) older than the specified retention period.

Results Cleanup
~~~~~~~~~~~~~~~

**Task:** ``prune_old_results``

**Schedule:** Weekly on Saturday at 5 AM

**Default Retention:** 5 months

Removes test result records older than the specified retention period.

**Important:** The retention period for results must be greater than the retention period for artifact files to avoid foreign key constraint errors.

Runs Cleanup
~~~~~~~~~~~~

**Task:** ``prune_old_runs``

**Schedule:** Weekly on Saturday at 6 AM

**Default Retention:** 12 months

Removes test run records older than the specified retention period.

**Important:** The retention period for runs must be greater than the retention period for results to avoid foreign key constraint errors.

Database Vacuum
---------------

PostgreSQL VACUUM is essential for reclaiming storage space and maintaining database performance after large deletions.

Why VACUUM is Important
~~~~~~~~~~~~~~~~~~~~~~~

PostgreSQL uses Multi-Version Concurrency Control (MVCC), which means deleted rows are not immediately removed from disk. Instead, they are marked as "dead tuples" and remain until a VACUUM operation reclaims the space.

After running cleanup tasks that delete large amounts of data, you should run VACUUM to:

1. **Reclaim disk space** - Remove dead tuples and return space to the operating system
2. **Update statistics** - Help the query planner make better decisions
3. **Prevent transaction ID wraparound** - Essential for database health

VACUUM Operations
~~~~~~~~~~~~~~~~~

**Standard VACUUM:**

.. code-block:: sql

   VACUUM (VERBOSE);

- Reclaims space but doesn't return it to the OS
- Can run concurrently with normal operations
- Recommended for regular maintenance

**VACUUM FULL:**

.. code-block:: sql

   VACUUM FULL (VERBOSE);

- Reclaims space and returns it to the OS
- Requires an exclusive lock on tables (blocks all operations)
- Use only during maintenance windows
- Rewrites entire tables, which can take significant time

Automated VACUUM
~~~~~~~~~~~~~~~~

Ibutsu deployments include a CronJob for automated VACUUM operations:

**iqe-keeper (Production):**

Located in ``ibutsu/prod/database_vacuum.yaml``:

.. code-block:: yaml

   schedule: 1 1 * * *  # Daily at 1:01 AM

**OCP Templates:**

Located in ``ocp-templates/*/postgres.yaml``:

.. code-block:: yaml

   schedule: ${VACUUM_SCHEDULE}  # Default: 1 1 * * * (Daily at 1:01 AM)

The automated VACUUM runs after the cleanup tasks complete, ensuring efficient space reclamation.

Manual VACUUM
~~~~~~~~~~~~~

To manually run VACUUM on specific tables:

.. code-block:: bash

   # Connect to the database
   psql -h $PGHOST -U $PGUSER -d $PGDATABASE

   # VACUUM specific tables
   VACUUM (VERBOSE, ANALYZE) imports;
   VACUUM (VERBOSE, ANALYZE) import_files;
   VACUUM (VERBOSE, ANALYZE) artifacts;
   VACUUM (VERBOSE, ANALYZE) results;
   VACUUM (VERBOSE, ANALYZE) runs;

   # Or VACUUM the entire database
   VACUUM (VERBOSE, ANALYZE);

Monitoring VACUUM
~~~~~~~~~~~~~~~~~

Check when tables were last vacuumed:

.. code-block:: sql

   SELECT
       schemaname,
       relname,
       last_vacuum,
       last_autovacuum,
       n_dead_tup,
       n_live_tup
   FROM pg_stat_user_tables
   WHERE schemaname = 'public'
   ORDER BY n_dead_tup DESC;

Storage Optimization Best Practices
------------------------------------

1. **Run cleanup tasks during low-traffic periods**

   The default schedule runs cleanup tasks on Saturday mornings when usage is typically lower.

2. **Monitor database size**

   .. code-block:: sql

      SELECT
          pg_size_pretty(pg_database_size('ibutsu')) as database_size;

      SELECT
          relname as table_name,
          pg_size_pretty(pg_total_relation_size(relid)) as total_size,
          pg_size_pretty(pg_relation_size(relid)) as table_size,
          pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;

3. **Adjust retention periods based on needs**

   Shorter retention periods reduce storage requirements but may limit historical analysis.

4. **Schedule VACUUM after cleanup tasks**

   The automated VACUUM runs at 1 AM daily, before the 2 AM import cleanup. For optimal space reclamation, consider adjusting the VACUUM schedule to run after cleanup tasks (e.g., at 3 AM).

5. **Consider VACUUM FULL for major cleanups**

   If you significantly reduce retention periods or perform a one-time large deletion, schedule a maintenance window for VACUUM FULL to reclaim maximum space.

Import Record Lifecycle
-----------------------

Understanding the lifecycle of import records helps optimize storage:

1. **Upload** - User uploads a file (XML or tar.gz)

   - ``imports`` record created with ``status='pending'``
   - ``import_files`` record created with full binary content
   - ``created`` timestamp set automatically

2. **Processing** - Celery worker processes the import

   - Status updated to ``status='running'``
   - Test results and artifacts extracted and stored
   - Run records created

3. **Completion** - Import finishes

   - Status updated to ``status='done'`` or ``status='error'``
   - ``clear_import_file_content`` task automatically clears binary content
   - Import record kept for audit trail

4. **Cleanup** - After retention period (7 days)

   - ``prune_old_import_files`` task deletes import record
   - Cascade delete removes associated ``import_files`` record
   - VACUUM reclaims disk space

Database Schema Considerations
-------------------------------

Import Tables
~~~~~~~~~~~~~

**imports table:**

- ``id`` (UUID) - Primary key
- ``filename`` (TEXT) - Original filename
- ``format`` (TEXT) - File format (junit, archive)
- ``status`` (TEXT) - Import status (pending, running, done, error)
- ``created`` (TIMESTAMP) - Creation time (NOT NULL, indexed)
- ``data`` (JSONB) - Metadata about the import

**import_files table:**

- ``id`` (UUID) - Primary key
- ``import_id`` (UUID) - Foreign key to imports (NOT NULL, indexed)
- ``content`` (BYTEA) - Binary file content (cleared after processing)

The ``import_id`` foreign key ensures referential integrity and enables cascade deletion.

Indexes
~~~~~~~

The ``created`` field on the ``imports`` table is indexed to optimize the cleanup query:

.. code-block:: sql

   CREATE INDEX ix_imports_created ON imports (created);

This index makes the age-based deletion query efficient even with millions of records.

Troubleshooting
---------------

Import Cleanup Not Running
~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Check if the scheduler is running:

   .. code-block:: bash

      # In Kubernetes/OpenShift
      kubectl get pods -l component=scheduler

2. Check Celery Beat logs:

   .. code-block:: bash

      kubectl logs -l component=scheduler -c scheduler

3. Verify the task is registered:

   .. code-block:: python

      from ibutsu_server.tasks.db import prune_old_import_files
      print(prune_old_import_files)

Database Size Not Decreasing
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Check if VACUUM is running:

   .. code-block:: bash

      kubectl get cronjobs
      kubectl get jobs

2. Manually run VACUUM:

   .. code-block:: bash

      kubectl exec -it postgresql-0 -- psql -U $PGUSER -d $PGDATABASE -c "VACUUM (VERBOSE, ANALYZE);"

3. Consider VACUUM FULL during a maintenance window:

   .. code-block:: bash

      # WARNING: This locks tables and can take hours on large databases
      kubectl exec -it postgresql-0 -- psql -U $PGUSER -d $PGDATABASE -c "VACUUM FULL (VERBOSE);"

Foreign Key Constraint Errors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you see foreign key constraint errors during cleanup:

1. Ensure cleanup tasks run in the correct order:

   - Import files (7 days)
   - Artifact files (3 months)
   - Results (5 months)
   - Runs (12 months)

2. Check for orphaned records:

   .. code-block:: sql

      -- Find import_files without imports
      SELECT COUNT(*) FROM import_files
      WHERE import_id NOT IN (SELECT id FROM imports);

3. The foreign key relationship should handle cascades automatically. If not, check the migration:

   .. code-block:: python

      sa.ForeignKeyConstraint(
          ["import_id"],
          ["imports.id"],
          ondelete="CASCADE",
      )

See Also
--------

- :doc:`alembic-migration` - Database schema migrations
- :doc:`celery-architecture` - Celery task scheduling
- :doc:`deployment-architecture` - Production deployment guide
- `PostgreSQL VACUUM Documentation <https://www.postgresql.org/docs/current/sql-vacuum.html>`_
