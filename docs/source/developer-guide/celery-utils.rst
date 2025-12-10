Celery Utils Module
===================

Overview
--------

The ``ibutsu_server.celery_utils`` module provides consolidated factory functions for creating Celery applications in Ibutsu. It implements two distinct configuration modes:

1. **Broker-Only Mode** - Minimal configuration for monitoring (Flower)
2. **Flask-Integrated Mode** - Full application context for task execution (Workers, Scheduler)

This architecture eliminates code duplication and provides a single source of truth for Celery app creation.

Architecture
------------

The module provides a unified interface for all Celery app creation::

    ┌─────────────────────────────────────────────────────────────┐
    │                    celery_utils.py                          │
    │                 (Single Source of Truth)                     │
    ├─────────────────────────────────────────────────────────────┤
    │                                                              │
    │  ┌──────────────────────────────────────────────────────┐  │
    │  │ create_broker_celery_app()                           │  │
    │  │ • Broker-only configuration                          │  │
    │  │ • No Flask app required                              │  │
    │  │ • No database access                                 │  │
    │  │ • Used by: Flower monitoring                         │  │
    │  └──────────────────────────────────────────────────────┘  │
    │                                                              │
    │  ┌──────────────────────────────────────────────────────┐  │
    │  │ create_flask_celery_app(flask_app, name)            │  │
    │  │ • Full Flask integration                             │  │
    │  │ • Database access via IbutsuTask                     │  │
    │  │ • Task imports & beat schedule                       │  │
    │  │ • Used by: Workers, Scheduler                        │  │
    │  └──────────────────────────────────────────────────────┘  │
    │                                                              │
    └─────────────────────────────────────────────────────────────┘

Factory Functions
-----------------

create_broker_celery_app()
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Creates a minimal broker-only Celery app for monitoring purposes.

**Function Signature:**

.. code-block:: python

   def create_broker_celery_app(name="ibutsu_server_flower") -> Celery

**Use Case:** Flower monitoring dashboard

**Configuration:**

* Reads ``CELERY_BROKER_URL`` from environment (required)
* Reads ``CELERY_RESULT_BACKEND`` from environment (optional, defaults to broker URL)
* Configures Redis socket timeouts and retry behavior
* Does NOT import task modules
* Does NOT require database access
* Does NOT initialize Flask app

**Example:**

.. code-block:: python

   from ibutsu_server.celery_utils import create_broker_celery_app

   # Create broker-only app for Flower
   flower_app = create_broker_celery_app(name="ibutsu_server_flower")

   # Use with Celery CLI:
   # celery --app=ibutsu_server:flower_app flower --port=5555

**Environment Variables:**

.. code-block:: bash

   CELERY_BROKER_URL=redis://:password@redis.example.com:6379/0
   CELERY_RESULT_BACKEND=redis://:password@redis.example.com:6379/0  # Optional

**Raises:**

* ``ValueError`` if ``CELERY_BROKER_URL`` is not set

create_flask_celery_app()
~~~~~~~~~~~~~~~~~~~~~~~~~~

Creates a Flask-integrated Celery app with full application context.

**Function Signature:**

.. code-block:: python

   def create_flask_celery_app(app: Flask, name="ibutsu_server") -> Celery

**Use Case:** Worker and Scheduler containers that execute tasks

**Configuration:**

* Requires Flask app instance with database configuration
* Stores Flask app reference for IbutsuTask context management
* Configures from Flask app config using ``CELERY`` namespace
* Imports all task modules (db, importers, query, results, runs)
* Configures beat schedule for periodic tasks
* Sets up signal handlers for task failure retry
* Stores Celery app in ``flask_app.extensions["celery"]``

**Example:**

.. code-block:: python

   from flask import Flask
   from ibutsu_server.celery_utils import create_flask_celery_app

   # Create Flask app with configuration
   flask_app = Flask(__name__)
   flask_app.config['CELERY'] = {
       'broker_url': 'redis://localhost:6379/0',
       'result_backend': 'redis://localhost:6379/0',
   }
   flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://...'

   # Create worker app
   worker_app = create_flask_celery_app(flask_app, name="ibutsu_server_worker")

   # Use with Celery CLI:
   # celery --app=ibutsu_server:worker_app worker --loglevel=info

**Flask Config Requirements:**

.. code-block:: python

   flask_app.config['CELERY'] = {
       'broker_url': 'redis://...',
       'result_backend': 'redis://...',
       'broker_connection_retry': True,
       'broker_connection_retry_on_startup': True,
       'worker_cancel_long_running_tasks_on_connection_loss': True,
       'include': [
           'ibutsu_server.tasks.db',
           'ibutsu_server.tasks.importers',
           'ibutsu_server.tasks.query',
           'ibutsu_server.tasks.results',
           'ibutsu_server.tasks.runs',
       ],
   }
   flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://...'

**Raises:**

* ``ValueError`` if Flask app is None

Integration with _AppRegistry
------------------------------

The ``_AppRegistry`` class in ``ibutsu_server/__init__.py`` delegates to these factory functions:

.. code-block:: python

   class _AppRegistry:
       @classmethod
       def get_flower_app(cls):
           if cls.flower_app is None:
               cls.flower_app = create_broker_celery_app(
                   name="ibutsu_server_flower"
               )
           return cls.flower_app

       @classmethod
       def get_worker_app(cls):
           if cls.worker_app is None:
               flask_app = cls.get_flask_app()
               cls.worker_app = create_flask_celery_app(
                   flask_app, name="ibutsu_server_worker"
               )
           return cls.worker_app

       @classmethod
       def get_scheduler_app(cls):
           if cls.scheduler_app is None:
               flask_app = cls.get_flask_app()
               cls.scheduler_app = create_flask_celery_app(
                   flask_app, name="ibutsu_server_scheduler"
               )
           return cls.scheduler_app

Module-Level Exports
--------------------

The module uses ``__getattr__`` for lazy initialization:

.. code-block:: python

   # Import any of these and they'll be initialized on first access
   from ibutsu_server import flower_app      # Broker-only
   from ibutsu_server import worker_app      # Flask-integrated
   from ibutsu_server import scheduler_app   # Flask-integrated

Container Entry Points
----------------------

Worker Container
~~~~~~~~~~~~~~~~

.. code-block:: dockerfile

   CMD ["celery", "--app", "ibutsu_server:worker_app", \
        "worker", "--events", "--loglevel=info"]

Scheduler Container
~~~~~~~~~~~~~~~~~~~

.. code-block:: dockerfile

   CMD ["celery", "--app", "ibutsu_server:scheduler_app", \
        "beat", "--loglevel=info"]

Flower Container
~~~~~~~~~~~~~~~~

.. code-block:: dockerfile

   CMD ["celery", "--app=ibutsu_server:flower_app", \
        "flower", "--port=5555"]

Configuration Comparison
------------------------

.. list-table::
   :header-rows: 1
   :widths: 30 35 35

   * - Feature
     - Broker-Only (Flower)
     - Flask-Integrated (Worker/Scheduler)
   * - **Factory Function**
     - ``create_broker_celery_app()``
     - ``create_flask_celery_app()``
   * - **Flask App Required**
     - ❌ No
     - ✅ Yes
   * - **Database Access**
     - ❌ No
     - ✅ Yes
   * - **Task Imports**
     - ❌ No
     - ✅ Yes
   * - **Beat Schedule**
     - ❌ No
     - ✅ Yes (periodic tasks)
   * - **IbutsuTask Context**
     - ❌ No
     - ✅ Yes (automatic)
   * - **Signal Handlers**
     - ❌ No
     - ✅ Yes (retry on failure)
   * - **Env Vars Required**
     - ``CELERY_BROKER_URL``
     - All Flask config + DB
   * - **Use Case**
     - Monitoring
     - Task execution

Socket Timeout Configuration
-----------------------------

Both factory functions configure Redis socket timeouts from ``ibutsu_server.constants``:

.. code-block:: python

   from ibutsu_server.constants import (
       SOCKET_TIMEOUT,
       SOCKET_CONNECT_TIMEOUT
   )

   # Applied to both broker-only and Flask-integrated apps
   celery_app.conf.redis_socket_timeout = SOCKET_TIMEOUT  # 5 seconds
   celery_app.conf.redis_socket_connect_timeout = SOCKET_CONNECT_TIMEOUT
   celery_app.conf.redis_retry_on_timeout = True
   celery_app.conf.broker_transport_options = {
       "socket_timeout": SOCKET_TIMEOUT,
       "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
   }
   celery_app.conf.result_backend_transport_options = {
       "socket_timeout": SOCKET_TIMEOUT,
       "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
   }

Beat Schedule (Flask-Integrated Only)
--------------------------------------

The Flask-integrated factory configures periodic tasks:

.. code-block:: python

   celery_app.conf.beat_schedule = {
       "prune-old-artifact-files": {
           "task": "ibutsu_server.tasks.db.prune_old_files",
           "schedule": crontab(minute=0, hour=4, day_of_week=6),
           "args": (3,),  # Delete files older than 3 months
       },
       "prune-old-results": {
           "task": "ibutsu_server.tasks.db.prune_old_results",
           "schedule": crontab(minute=0, hour=5, day_of_week=6),
           "args": (5,),  # Delete results older than 5 months
       },
       "prune-old-runs": {
           "task": "ibutsu_server.tasks.db.prune_old_runs",
           "schedule": crontab(minute=0, hour=6, day_of_week=6),
           "args": (12,),  # Delete runs older than 12 months
       },
       "sync-aborted-runs": {
           "task": "ibutsu_server.tasks.runs.sync_aborted_runs",
           "schedule": 0.5 * 60 * 60,  # Every 30 minutes
       },
   }

Backward Compatibility
----------------------

The old ``ibutsu_server.tasks.create_celery_app()`` function is maintained as a thin wrapper:

.. code-block:: python

   # Old code (still works)
   from ibutsu_server.tasks import create_celery_app
   celery_app = create_celery_app(flask_app, name="my_app")

   # New code (preferred)
   from ibutsu_server.celery_utils import create_flask_celery_app
   celery_app = create_flask_celery_app(flask_app, name="my_app")

Testing
-------

Comprehensive tests are available in ``tests/test_celery_utils.py``:

.. code-block:: python

   # Test broker-only factory
   def test_create_broker_celery_app_configuration():
       app = create_broker_celery_app()
       assert app.conf.broker_url is not None
       assert app.main == "ibutsu_server_flower"

   # Test Flask-integrated factory
   def test_create_flask_celery_app_configuration(flask_app):
       client, _ = flask_app
       app = create_flask_celery_app(client.application)
       assert "celery" in client.application.extensions
       assert app.conf.beat_schedule is not None

Migration Guide
---------------

For New Code
~~~~~~~~~~~~

Use the factory functions directly:

.. code-block:: python

   # For Flower monitoring
   from ibutsu_server.celery_utils import create_broker_celery_app
   flower_app = create_broker_celery_app()

   # For workers/scheduler
   from ibutsu_server.celery_utils import create_flask_celery_app
   worker_app = create_flask_celery_app(flask_app, name="worker")

For Existing Code
~~~~~~~~~~~~~~~~~

No changes required. The old API still works:

.. code-block:: python

   # This continues to work
   from ibutsu_server.tasks import create_celery_app
   celery_app = create_celery_app(flask_app)

Troubleshooting
---------------

Flower Can't Connect to Broker
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Flower fails to start with connection errors

**Solution:** Ensure ``CELERY_BROKER_URL`` environment variable is set:

.. code-block:: bash

   export CELERY_BROKER_URL=redis://:password@redis.example.com:6379/0

Worker Can't Access Database
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Tasks fail with "No application context" or database connection errors

**Solution:** Ensure Flask app is properly configured with database URI:

.. code-block:: python

   flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://...'

Tasks Not Discovered
~~~~~~~~~~~~~~~~~~~~

**Symptom:** Worker starts but tasks are not registered

**Solution:** Ensure task modules are imported in ``create_flask_celery_app()``. Check that all task files are in ``ibutsu_server/tasks/`` and properly decorated with ``@shared_task``.

Beat Schedule Not Running
~~~~~~~~~~~~~~~~~~~~~~~~~~

**Symptom:** Periodic tasks don't execute

**Solution:** Ensure you're using the scheduler app, not the worker app:

.. code-block:: bash

   celery --app=ibutsu_server:scheduler_app beat --loglevel=info

See Also
--------

* ``ibutsu_server/util/celery_task.py`` - IbutsuTask base class
* ``ibutsu_server/util/app_context.py`` - Flask context management
* ``tests/test_celery_utils.py`` - Comprehensive test suite
* :doc:`deployment-architecture` - Deployment architecture overview
