Celery Architecture and Deployment
===================================

Overview
--------

Ibutsu uses Celery for asynchronous task processing with three distinct application types, each optimized for its specific role:

1. **Flower** - Broker-only monitoring (no database)
2. **Worker** - Full Flask integration for task execution (with database)
3. **Scheduler** - Full Flask integration for periodic tasks (with database)

Architecture Diagram
--------------------

The Celery architecture uses a Redis broker for task queue management::

    ┌─────────────────────────────────────────────────────────────────┐
    │                    Redis Broker                                  │
    │                  (Task Queue & Results)                          │
    └───────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
            │                     │                     │
    ┌───────▼──────────┐  ┌───────▼──────────┐  ┌──────▼──────────┐
    │   Flower Pod     │  │   Worker Pod     │  │  Scheduler Pod  │
    │                  │  │                  │  │                 │
    │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌─────────────┐ │
    │ │ flower_app   │ │  │ │ worker_app   │ │  │ │scheduler_app│ │
    │ │              │ │  │ │              │ │  │ │             │ │
    │ │ Broker-Only  │ │  │ │ Flask + DB   │ │  │ │ Flask + DB  │ │
    │ │ Monitoring   │ │  │ │ Task Exec    │ │  │ │ Beat Sched  │ │
    │ └──────────────┘ │  │ └──────┬───────┘ │  │ └──────┬──────┘ │
    │                  │  │        │         │  │        │        │
    └──────────────────┘  └────────┼─────────┘  └────────┼────────┘
                                   │                     │
                                   │                     │
                            ┌──────▼─────────────────────▼──────┐
                            │      PostgreSQL Database          │
                            │   (Projects, Runs, Results, etc)  │
                            └───────────────────────────────────┘

Application Types
-----------------

Flower App (Broker-Only Monitoring)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Purpose:** Web-based monitoring dashboard for Celery tasks

**Configuration Mode:** Broker-only (no database access)

**Entry Point:** ``ibutsu_server:flower_app``

**Factory Function:** ``create_broker_celery_app()`` from ``celery_utils.py``

**Environment Variables Required:**

.. code-block:: yaml

   - CELERY_BROKER_URL: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - CELERY_RESULT_BACKEND: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - FLOWER_BASIC_AUTH: username:password  # For web UI authentication

**Environment Variables NOT Required:**

* ❌ POSTGRESQL_HOST
* ❌ POSTGRESQL_USER
* ❌ POSTGRESQL_PASSWORD
* ❌ POSTGRESQL_DATABASE

**Features:**

* ✅ Monitor task execution in real-time
* ✅ View task results and history
* ✅ Inspect worker status
* ✅ Task discovery via broker introspection
* ❌ No database queries
* ❌ No task execution

**Deployment:** Co-located with Scheduler in OpenShift/Kubernetes

Worker App (Flask-Integrated Task Execution)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Purpose:** Execute asynchronous tasks with full database access

**Configuration Mode:** Flask-integrated (full app context)

**Entry Point:** ``ibutsu_server:worker_app``

**Factory Function:** ``create_flask_celery_app()`` from ``celery_utils.py``

**Environment Variables Required:**

.. code-block:: yaml

   - CELERY_BROKER_URL: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - CELERY_RESULT_BACKEND: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - POSTGRESQL_HOST: postgresql.svc
   - POSTGRESQL_PORT: "5432"
   - POSTGRESQL_USER: <from secret>
   - POSTGRESQL_PASSWORD: <from secret>
   - POSTGRESQL_DATABASE: <from secret>

**Features:**

* ✅ Execute all Celery tasks
* ✅ Full database access via SQLAlchemy
* ✅ Flask application context for all tasks
* ✅ Automatic session management via IbutsuTask
* ✅ Task retry with exponential backoff
* ❌ No beat schedule (use Scheduler for periodic tasks)

**Task Modules Loaded:**

* ``ibutsu_server.tasks.db`` - Database maintenance tasks
* ``ibutsu_server.tasks.importers`` - Import result data
* ``ibutsu_server.tasks.query`` - Complex query operations
* ``ibutsu_server.tasks.results`` - Result processing
* ``ibutsu_server.tasks.runs`` - Run management

**Deployment:** Dedicated pod, can be scaled horizontally

Scheduler App (Flask-Integrated Periodic Tasks)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Purpose:** Schedule and trigger periodic maintenance tasks

**Configuration Mode:** Flask-integrated (full app context)

**Entry Point:** ``ibutsu_server:scheduler_app``

**Factory Function:** ``create_flask_celery_app()`` from ``celery_utils.py``

**Environment Variables Required:**

.. code-block:: yaml

   - CELERY_BROKER_URL: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - CELERY_RESULT_BACKEND: redis://:$(REDIS_PASSWORD)@redis.svc:6379
   - POSTGRESQL_HOST: postgresql.svc
   - POSTGRESQL_PORT: "5432"
   - POSTGRESQL_USER: <from secret>
   - POSTGRESQL_PASSWORD: <from secret>
   - POSTGRESQL_DATABASE: <from secret>

**Features:**

* ✅ Run Celery Beat scheduler
* ✅ Trigger periodic tasks on schedule
* ✅ Full database access
* ✅ Flask application context
* ❌ Does not execute tasks (sends to workers)

**Beat Schedule (Periodic Tasks):**

.. code-block:: python

   {
       "prune-old-artifact-files": {
           "schedule": "4 AM every Saturday",
           "task": "ibutsu_server.tasks.db.prune_old_files",
           "args": (3,),  # Delete files older than 3 months
       },
       "prune-old-results": {
           "schedule": "5 AM every Saturday",
           "task": "ibutsu_server.tasks.db.prune_old_results",
           "args": (5,),  # Delete results older than 5 months
       },
       "prune-old-runs": {
           "schedule": "6 AM every Saturday",
           "task": "ibutsu_server.tasks.db.prune_old_runs",
           "args": (12,),  # Delete runs older than 12 months
       },
       "sync-aborted-runs": {
           "schedule": "Every 30 minutes",
           "task": "ibutsu_server.tasks.runs.sync_aborted_runs",
       },
   }

**Deployment:** Co-located with Flower in a single pod

OpenShift/Kubernetes Deployment
--------------------------------

Worker Deployment
~~~~~~~~~~~~~~~~~

Deploys worker pods for task execution:

.. code-block:: yaml

   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ibutsu-worker
   spec:
     replicas: 1  # Scale as needed
     template:
       spec:
         containers:
         - name: ibutsu-worker
           image: ibutsu-worker:${IMAGE_TAG}
           env:
             # PostgreSQL configuration (required)
             - name: POSTGRESQL_HOST
             - name: POSTGRESQL_PORT
             - name: POSTGRESQL_USER
             - name: POSTGRESQL_PASSWORD
             - name: POSTGRESQL_DATABASE
             # Redis configuration (required)
             - name: CELERY_BROKER_URL
             - name: CELERY_RESULT_BACKEND

**Scaling:** Can be scaled horizontally (multiple replicas) for increased throughput

Scheduler Deployment
~~~~~~~~~~~~~~~~~~~~

Deploys scheduler + flower in a single pod:

.. code-block:: yaml

   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ibutsu-scheduler
   spec:
     replicas: 1  # Must be exactly 1 (Beat scheduler limitation)
     template:
       spec:
         containers:
         # Container 1: Scheduler (requires database)
         - name: ibutsu-scheduler
           image: ibutsu-scheduler:${IMAGE_TAG}
           env:
             - name: POSTGRESQL_HOST
             - name: POSTGRESQL_USER
             - name: POSTGRESQL_PASSWORD
             - name: POSTGRESQL_DATABASE
             - name: CELERY_BROKER_URL
             - name: CELERY_RESULT_BACKEND

         # Container 2: Flower (no database required)
         - name: ibutsu-flower
           image: ibutsu-flower:${IMAGE_TAG}
           env:
             - name: CELERY_BROKER_URL
             - name: CELERY_RESULT_BACKEND
             - name: FLOWER_BASIC_AUTH
           ports:
           - containerPort: 5555

**Scaling:** Must be exactly 1 replica (Beat scheduler limitation)

Configuration Comparison
------------------------

.. list-table::
   :header-rows: 1
   :widths: 25 25 25 25

   * - Feature
     - Flower
     - Worker
     - Scheduler
   * - **App Name**
     - ``flower_app``
     - ``worker_app``
     - ``scheduler_app``
   * - **Factory**
     - ``create_broker_celery_app()``
     - ``create_flask_celery_app()``
     - ``create_flask_celery_app()``
   * - **Flask Integration**
     - ❌ No
     - ✅ Yes
     - ✅ Yes
   * - **Database Access**
     - ❌ No
     - ✅ Yes
     - ✅ Yes
   * - **PostgreSQL Env**
     - ❌ Not needed
     - ✅ Required
     - ✅ Required
   * - **Redis Env**
     - ✅ Required
     - ✅ Required
     - ✅ Required
   * - **Task Execution**
     - ❌ No
     - ✅ Yes
     - ❌ No (delegates)
   * - **Beat Schedule**
     - ❌ No
     - ❌ No
     - ✅ Yes
   * - **Monitoring**
     - ✅ Yes
     - ❌ No
     - ❌ No
   * - **Scalable**
     - ✅ Yes
     - ✅ Yes
     - ❌ No (must be 1)

Task Flow Example
-----------------

Example workflow for test result import:

1. **User uploads test results via Backend API**

   Backend enqueues task: ``import_results.delay(file_id)``

2. **Redis Broker receives task**

   Task queued in Redis

3. **Worker picks up task**

   * IbutsuTask provides Flask app context
   * Task accesses database via SQLAlchemy
   * Processes results and stores in database
   * Task completes, result stored in Redis

4. **Flower displays task status**

   Queries Redis broker for task info

5. **Scheduler triggers periodic cleanup (Saturday 4 AM)**

   * Beat scheduler sends ``prune_old_files`` task to Redis
   * Worker picks up and executes cleanup

Troubleshooting
---------------

Flower Can't See Tasks
~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Flower UI shows no tasks or workers

**Possible Causes:**

1. Workers not running
2. Redis connection issues
3. Wrong ``CELERY_BROKER_URL``

**Solution:**

.. code-block:: bash

   # Check worker pods are running
   kubectl get pods -l app=ibutsu-worker

   # Check Redis connectivity from Flower pod
   kubectl exec -it <flower-pod> -- redis-cli -h redis.svc -a <password> ping

   # Verify CELERY_BROKER_URL matches across all containers
   kubectl get deployment ibutsu-worker -o yaml | grep CELERY_BROKER_URL
   kubectl get deployment ibutsu-scheduler -o yaml | grep CELERY_BROKER_URL

Worker Tasks Fail with Database Errors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Tasks fail with "no application context" or database connection errors

**Possible Causes:**

1. Missing PostgreSQL environment variables
2. Database not accessible from worker pod
3. Wrong database credentials

**Solution:**

.. code-block:: bash

   # Check PostgreSQL environment variables are set
   kubectl exec -it <worker-pod> -- env | grep POSTGRESQL

   # Test database connectivity
   kubectl exec -it <worker-pod> -- \
     psql -h postgresql.svc -U <user> -d <database> -c "SELECT 1"

   # Check database secret exists
   kubectl get secret postgresql

Periodic Tasks Not Running
~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Scheduled tasks (pruning, sync) don't execute

**Possible Causes:**

1. Scheduler pod not running
2. Multiple scheduler replicas (Beat limitation)
3. Scheduler can't access database

**Solution:**

.. code-block:: bash

   # Check scheduler pod is running
   kubectl get pods -l app=ibutsu-scheduler

   # Verify exactly 1 replica
   kubectl get deployment ibutsu-scheduler -o jsonpath='{.spec.replicas}'

   # Check scheduler logs for beat schedule
   kubectl logs <scheduler-pod> -c ibutsu-scheduler | grep "beat_schedule"

High Redis Memory Usage
~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Redis pod using excessive memory

**Possible Causes:**

1. Too many task results stored
2. Long task result expiration
3. Large task payloads

**Solution:**

.. code-block:: bash

   # Check Redis memory usage
   kubectl exec -it <redis-pod> -- redis-cli -a <password> INFO memory

   # Check number of keys
   kubectl exec -it <redis-pod> -- redis-cli -a <password> DBSIZE

   # Configure result expiration in backend config
   # Set CELERY_RESULT_EXPIRES environment variable

Deployment Checklist
--------------------

Initial Deployment
~~~~~~~~~~~~~~~~~~

#. Deploy Redis (required by all)
#. Deploy PostgreSQL (required by worker & scheduler)
#. Create secrets for database credentials
#. Create secrets for Redis password
#. Create secret for Flower authentication
#. Deploy backend (API server)
#. Deploy worker (task execution)
#. Deploy scheduler + flower (periodic tasks + monitoring)
#. Verify all pods are running
#. Access Flower UI to confirm workers are connected
#. Test task execution via backend API

Scaling Workers
~~~~~~~~~~~~~~~

To increase task throughput:

.. code-block:: bash

   # Scale workers horizontally
   kubectl scale deployment ibutsu-worker --replicas=3

   # Verify all workers are connected
   # Check Flower UI or:
   kubectl logs <worker-pod> | grep "Connected to redis"

.. warning::

   Do NOT scale scheduler (must remain at 1 replica)

Upgrading
~~~~~~~~~

When upgrading Ibutsu:

1. Update image tags in deployment manifests
2. Apply deployments in order:

   * Backend (API server)
   * Worker (will restart and reconnect)
   * Scheduler (will restart beat schedule)

3. Monitor Flower UI for worker reconnection
4. Verify periodic tasks still scheduled

Environment Variable Reference
------------------------------

Required for All Containers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: yaml

   CELERY_BROKER_URL: redis://:password@redis.svc:6379/0
   CELERY_RESULT_BACKEND: redis://:password@redis.svc:6379/0

Required for Worker & Scheduler Only
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: yaml

   POSTGRESQL_HOST: postgresql.svc
   POSTGRESQL_PORT: "5432"
   POSTGRESQL_USER: ibutsu
   POSTGRESQL_PASSWORD: <from secret>
   POSTGRESQL_DATABASE: ibutsu

Required for Flower Only
~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: yaml

   FLOWER_BASIC_AUTH: username:password

Optional Configuration
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: yaml

   # Celery worker concurrency (default: 1)
   CELERY_WORKER_CONCURRENCY: "4"

   # Task result expiration (default: 1 day)
   CELERY_RESULT_EXPIRES: "86400"

   # Task time limit (default: none)
   CELERY_TASK_TIME_LIMIT: "3600"

   # Worker log level (default: info)
   CELERY_WORKER_LOGLEVEL: "info"

See Also
--------

* :doc:`celery-utils` - Celery factory functions API documentation
* :doc:`deployment-architecture` - General deployment architecture
* ``ocp-templates/README.md`` - OpenShift template documentation
