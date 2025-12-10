Deployment Architecture
=======================

Overview
--------

The Ibutsu backend uses a modern ASGI-based architecture with Gunicorn as the process manager and Uvicorn as the ASGI worker implementation. This document explains the deployment architecture, configuration, and rationale.

Architecture Stack
------------------

Layer 1: Gunicorn (Process Manager)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Role:** Production-grade WSGI/ASGI application server

* Manages multiple worker processes
* Handles graceful restarts and zero-downtime deployments
* Provides worker health monitoring and auto-restart
* Load balances requests across workers
* Integrates with reverse proxies (OpenShift routes, nginx, etc.)

**Configuration:** ``backend/config.py``

.. code-block:: python

   workers = int(os.environ.get("GUNICORN_PROCESSES", "1"))
   threads = int(os.environ.get("GUNICORN_THREADS", "1"))

Layer 2: Uvicorn Worker
~~~~~~~~~~~~~~~~~~~~~~~~

**Role:** ASGI worker implementation for Gunicorn (``uvicorn.workers.UvicornWorker``)

* Provides ASGI protocol support (required for Connexion 3.0)
* Bridges Gunicorn's process management with async I/O capabilities
* Automatically enables high-performance components (uvloop, httptools)

**Why UvicornWorker?**

* Connexion 3.0 is ASGI-only (not WSGI compatible)
* Standard Gunicorn workers are synchronous (WSGI)
* UvicornWorker allows Gunicorn to manage async ASGI applications

Layer 3: uvloop (Event Loop)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Role:** High-performance asyncio event loop replacement

* Written in Cython for near-native performance
* 2-4x faster than standard Python asyncio event loop
* Drop-in replacement, automatically used by Uvicorn
* Powers all async/await operations in the application

**Performance Benefits:**

* Fast I/O operations (database, Redis, HTTP)
* Efficient handling of concurrent connections
* Low latency for async tasks

**Reference:** https://github.com/MagicStack/uvloop

Layer 4: httptools (Protocol Parser)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Role:** Fast HTTP request/response parser

* Written in C for maximum performance
* Handles HTTP/1.1 protocol parsing
* Used by Uvicorn for request processing

**Reference:** https://github.com/MagicStack/httptools

Container Entrypoint
--------------------

Production Dockerfile
~~~~~~~~~~~~~~~~~~~~~

File: ``backend/docker/Dockerfile.backend``

.. code-block:: dockerfile

   CMD ["gunicorn", \
        "-k", "uvicorn.workers.UvicornWorker", \
        "-c", "config.py", \
        "--bind", "0.0.0.0:8080", \
        "--access-logfile", "-", \
        "--error-logfile", "-", \
        "ibutsu_server:connexion_app"]

**Command Breakdown:**

* ``gunicorn`` - Main process manager
* ``-k uvicorn.workers.UvicornWorker`` - Use Uvicorn as worker class
* ``-c config.py`` - Load configuration from config.py
* ``--bind 0.0.0.0:8080`` - Listen on all interfaces, port 8080
* ``--access-logfile -`` - Access logs to stdout
* ``--error-logfile -`` - Error logs to stderr
* ``ibutsu_server:connexion_app`` - ASGI application to serve

Development Entrypoints
~~~~~~~~~~~~~~~~~~~~~~~

For local development, simpler configurations are used:

**Option 1: Direct Uvicorn (with hot reload)**

.. code-block:: bash

   uvicorn ibutsu_server:connexion_app --host 0.0.0.0 --port 8080 --reload

**Option 2: Python module**

.. code-block:: bash

   python -m ibutsu_server --host 0.0.0.0

These bypass Gunicorn for easier debugging but lack production features.

Configuration
-------------

Environment Variables
~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 30 15 55

   * - Variable
     - Default
     - Description
   * - ``GUNICORN_PROCESSES``
     - ``1``
     - Number of worker processes
   * - ``GUNICORN_THREADS``
     - ``1``
     - Threads per worker
   * - ``PORT``
     - ``8080``
     - HTTP server port
   * - ``APP_CONFIG``
     - ``config.py``
     - Path to Gunicorn config file

Scaling Workers
~~~~~~~~~~~~~~~

**Horizontal Scaling (Processes):**

.. code-block:: bash

   export GUNICORN_PROCESSES=4  # Multiple worker processes

**Vertical Scaling (Threads):**

.. code-block:: bash

   export GUNICORN_THREADS=2    # Multiple threads per worker

**Recommendation:**

* Start with ``GUNICORN_PROCESSES=1`` for most workloads
* Increase processes if CPU-bound operations dominate
* ASGI async I/O typically doesn't require multiple processes
* Monitor memory usage when scaling (each process loads full application)

Reverse Proxy Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The backend is designed to run behind reverse proxies (OpenShift routes, nginx, etc.):

.. code-block:: python

   # config.py
   forwarded_allow_ips = "*"
   secure_scheme_headers = {"X-Forwarded-Proto": "https"}

This ensures:

* Proper client IP detection from ``X-Forwarded-For``
* HTTPS scheme detection for URL generation
* Trust in proxy headers

Why This Architecture?
----------------------

Problem Statement
~~~~~~~~~~~~~~~~~

1. **Connexion 3.0 requires ASGI:** The modern Connexion framework (OpenAPI-first) is built on ASGI, not WSGI
2. **Need process management:** Production deployments require worker lifecycle management, graceful restarts, health checks
3. **Want async performance:** Ibutsu makes many I/O calls (database, Redis, Celery) that benefit from async

Solution: Gunicorn + Uvicorn
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 25 25 50

   * - Component
     - Provides
     - Why?
   * - **Gunicorn**
     - Process management
     - Battle-tested, production-ready, zero-downtime deploys
   * - **UvicornWorker**
     - ASGI bridge
     - Allows Gunicorn to manage ASGI apps
   * - **uvloop**
     - Fast async I/O
     - 2-4x performance boost for async operations
   * - **httptools**
     - Fast HTTP parsing
     - C-based parser for request handling

Alternatives Considered
~~~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Alternative
     - Why Not Used
   * - **Gunicorn alone**
     - Doesn't support ASGI (only WSGI)
   * - **Uvicorn alone**
     - Lacks robust process management features
   * - **Hypercorn**
     - Less mature than Uvicorn, smaller ecosystem
   * - **Daphne**
     - Django-focused, heavier dependencies

Deployment Scenarios
--------------------

OpenShift/Kubernetes
~~~~~~~~~~~~~~~~~~~~

The container runs with the Dockerfile CMD:

.. code-block:: yaml

   containers:
     - name: ibutsu-backend
       image: quay.io/ibutsu/backend:main
       env:
         - name: GUNICORN_PROCESSES
           value: "1"
         - name: APP_CONFIG
           value: config.py
       ports:
         - containerPort: 8080

**No command override needed** - the Dockerfile CMD is production-ready.

Docker Compose
~~~~~~~~~~~~~~

.. code-block:: yaml

   services:
     backend:
       image: ibutsu/backend
       environment:
         GUNICORN_PROCESSES: "1"
       ports:
         - "8080:8080"

Local Development (Podman)
~~~~~~~~~~~~~~~~~~~~~~~~~~~

For development with hot reload:

.. code-block:: bash

   podman run -v ./backend:/app ibutsu/backend \
     uvicorn ibutsu_server:connexion_app --reload

Monitoring and Observability
-----------------------------

Health Checks
~~~~~~~~~~~~~

The backend exposes health check endpoints:

* ``GET /`` - Basic health check
* ``GET /api/health`` - Detailed health status

Configure in Kubernetes:

.. code-block:: yaml

   livenessProbe:
     httpGet:
       path: /
       port: 8080
     initialDelaySeconds: 0
     periodSeconds: 30

   readinessProbe:
     httpGet:
       path: /
       port: 8080
     initialDelaySeconds: 5
     periodSeconds: 10

Logs
~~~~

Logs are written to stdout/stderr for container-friendly logging:

* **Access logs:** HTTP requests (stdout)
* **Error logs:** Application errors (stderr)
* **Application logs:** Python logging to stdout

View with:

.. code-block:: bash

   # Kubernetes/OpenShift
   kubectl logs deployment/ibutsu-backend

   # Podman
   podman logs ibutsu-backend

Metrics
~~~~~~~

Gunicorn provides basic metrics through:

* Process CPU/memory usage
* Request count and latency
* Worker status

For detailed metrics, integrate with:

* Prometheus (via ``prometheus-flask-exporter``)
* OpenTelemetry
* Application Performance Monitoring (APM) tools

Performance Tuning
------------------

Worker Configuration
~~~~~~~~~~~~~~~~~~~~

**Single Worker (Default):**

* Memory efficient
* Sufficient for most workloads with async I/O
* Recommended for containerized deployments

**Multiple Workers:**

.. code-block:: bash

   GUNICORN_PROCESSES=4  # 2 x CPU cores is common starting point

**When to scale workers:**

* ✅ CPU-bound operations (heavy computation)
* ✅ High request volume (> 1000 req/min per worker)
* ❌ Memory-bound (each worker duplicates memory)
* ❌ Pure I/O-bound (async handles this efficiently)

Connection Pooling
~~~~~~~~~~~~~~~~~~

Database and Redis connections are pooled:

* SQLAlchemy connection pool for PostgreSQL
* Redis connection pool for Celery/cache
* Connections shared within a worker process

Database Query Optimization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Statement timeout set to prevent long-running queries:

.. code-block:: python

   # __init__.py
   SQLALCHEMY_ENGINE_OPTIONS = {
       "connect_args": {"options": "-c statement_timeout=25000"}
   }

Container Images
----------------

Image Registry
~~~~~~~~~~~~~~

Images are built and pushed to Quay.io:

* ``quay.io/ibutsu/backend:main`` - Latest from main branch
* ``quay.io/ibutsu/backend:v2.5.8`` - Versioned releases

Image Stream Tags
~~~~~~~~~~~~~~~~~

In OpenShift, ImageStreams track container images:

.. code-block:: yaml

   kind: ImageStream
   metadata:
     name: backend
   spec:
     tags:
       - name: main
         from:
           kind: DockerImage
           name: quay.io/ibutsu/backend:main
         importPolicy:
           scheduled: true  # Auto-update on new pushes

Related Components
------------------

The backend is part of a larger system:

.. list-table::
   :header-rows: 1
   :widths: 25 25 50

   * - Component
     - Container
     - Purpose
   * - **Backend**
     - ``ibutsu/backend``
     - API server (this document)
   * - **Worker**
     - ``ibutsu/worker``
     - Celery task worker
   * - **Scheduler**
     - ``ibutsu/scheduler``
     - Celery beat scheduler
   * - **Flower**
     - ``ibutsu/flower``
     - Celery monitoring UI
   * - **Frontend**
     - ``ibutsu/frontend``
     - React UI

Each has its own entrypoint:

* **Worker:** ``celery worker`` (not ASGI, async via Celery)
* **Scheduler:** ``celery beat`` (periodic task scheduler)
* **Flower:** ``celery flower`` (monitoring interface)

Documentation References
------------------------

Official Documentation
~~~~~~~~~~~~~~~~~~~~~~

1. **Uvicorn Deployment Guide**

   https://www.uvicorn.org/#running-with-gunicorn

   - Comprehensive guide to Gunicorn + Uvicorn setup
   - Configuration examples and best practices

2. **Gunicorn Documentation**

   https://docs.gunicorn.org/en/stable/

   - Configuration reference
   - Worker types and deployment patterns

3. **Connexion 3.0 Documentation**

   https://connexion.readthedocs.io/en/latest/v3.html

   - ASGI application architecture
   - OpenAPI-first design patterns

4. **uvloop GitHub**

   https://github.com/MagicStack/uvloop

   - Performance benchmarks
   - Implementation details

5. **httptools GitHub**

   https://github.com/MagicStack/httptools

   - HTTP parser implementation
   - Performance characteristics

Related Internal Documentation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* Backend setup and development - See getting-started
* Build and test with Hatch - See hatch-usage
* OpenShift deployment templates - ``ocp-templates/README.md``
* Celery configuration - ``CELERY_ENV_VAR_CONSISTENCY_SUMMARY.md``

Troubleshooting
---------------

Container Won't Start
~~~~~~~~~~~~~~~~~~~~~

**Check logs:**

.. code-block:: bash

   kubectl logs deployment/ibutsu-backend --tail=100

**Common issues:**

* Missing ``CELERY_BROKER_URL`` environment variable
* Missing ``CELERY_RESULT_BACKEND`` environment variable
* Database connection failure (wrong credentials/host)
* Port 8080 already in use

Performance Issues
~~~~~~~~~~~~~~~~~~

**High CPU:**

* Check for slow database queries
* Review async task implementations
* Consider scaling workers (``GUNICORN_PROCESSES``)

**High Memory:**

* Each worker duplicates memory
* Reduce ``GUNICORN_PROCESSES`` if memory-constrained
* Check for memory leaks in application code

**Slow Responses:**

* Enable debug logging: ``--log-level debug``
* Check database query performance
* Review Celery task execution time
* Check Redis connection latency

Worker Crashes
~~~~~~~~~~~~~~

Gunicorn automatically restarts crashed workers:

.. code-block:: text

   [2025-12-10 10:15:23 +0000] [1234] [WARNING] Worker with pid 5678 was terminated
   [2025-12-10 10:15:23 +0000] [1234] [INFO] Booting worker with pid: 5679

**Investigate crashes:**

* Check stderr logs for exceptions
* Review memory usage (OOM kills)
* Check for segfaults (native library issues)

Summary
-------

The Ibutsu backend uses a **layered architecture** for production deployments:

1. **Gunicorn** manages worker processes (lifecycle, health, scaling)
2. **UvicornWorker** provides ASGI support for Connexion 3.0
3. **uvloop** accelerates async I/O operations (2-4x faster)
4. **httptools** provides fast HTTP protocol parsing

This architecture delivers:

* ✅ Production-grade process management
* ✅ High-performance async I/O
* ✅ ASGI support for modern frameworks
* ✅ Container-friendly logging and health checks
* ✅ Horizontal and vertical scalability

For questions or issues, refer to the documentation links above or consult the development team.
