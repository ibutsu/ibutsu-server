Celery Worker Scaling and Performance
======================================

Overview
--------

Ibutsu's Celery workers are configured with performance optimizations and dynamic scaling capabilities to handle varying workloads efficiently. This document describes:

* Worker pool types and selection criteria
* Ibutsu-specific performance settings in ``celery_utils.py``
* Celery autoscaling configuration and tuning
* Production deployment recommendations
* Monitoring and troubleshooting

The focus is on Celery's built-in autoscaling mechanism, which dynamically adjusts task concurrency based on queue depth.

Worker Pool Types
-----------------

Ibutsu workers default to **gevent** for asynchronous I/O operations with minimal memory overhead. Configure via the ``CELERY_POOL`` environment variable.

Gevent Pool (Default)
~~~~~~~~~~~~~~~~~~~~~

**Recommended for:** I/O-bound workloads (database queries, HTTP requests, file operations)

* **Concurrency Model:** Cooperative multitasking using greenlets
* **Memory Usage:** 200-300MB per worker
* **Best for:** Ibutsu's typical workload profile
* **Compatible with:** SQLAlchemy, requests/httpx, Google API client
* **Not suitable for:** CPU-intensive blocking tasks

**Configuration:**

.. code-block:: bash

   CELERY_POOL=gevent
   CELERY_AUTOSCALE=20,2  # Recommended: autoscale max,min

**Why gevent for Ibutsu:**

* Most tasks are I/O-bound (database, API calls)
* Memory efficient: supports higher concurrency with fewer resources
* Works well with autoscaling to handle variable queue depth

Worker Performance Settings
---------------------------

The following settings are configured in ``celery_utils.py`` to optimize worker performance and resource utilization.

Prefetch Multiplier
~~~~~~~~~~~~~~~~~~~

**Setting:** ``worker_prefetch_multiplier = 1``

**Purpose:** Control how many tasks each worker process prefetches from the broker

**Rationale:**

* **Value of 1:** Each worker prefetches only 1 task at a time
* Ensures even task distribution across workers
* Prevents task starvation when worker pool is heterogeneous
* Reduces wasted work if worker restarts (only 1 task lost)

Max Tasks Per Child
~~~~~~~~~~~~~~~~~~~

**Setting:** ``worker_max_tasks_per_child = 100``

**Purpose:** Restart worker processes after executing N tasks to prevent memory leaks

**Rationale:**

* **Memory Leak Prevention:** Long-running workers may accumulate memory
* **Fresh State:** Periodic restarts clear leaked connections, file handles
* **Graceful Restart:** Worker finishes current task before restarting
* **100 tasks:** Balance between restart overhead and leak mitigation

**Production Tuning:**

.. code-block:: python

   # Default (recommended starting point)
   worker_max_tasks_per_child = 100

   # If seeing memory growth, restart more frequently
   worker_max_tasks_per_child = 50

   # If tasks are very fast and restarts cause overhead
   worker_max_tasks_per_child = 500

   # To disable (not recommended)
   worker_max_tasks_per_child = None

**When to Adjust:**

* **Decrease (50):** Memory usage grows over time in production
* **Increase (200-500):** Tasks are very fast, restart overhead noticeable
* **Monitor:** Track worker memory usage over time in Kubernetes metrics

Result Expiration
~~~~~~~~~~~~~~~~~

**Setting:** ``result_expires = 3600``

**Purpose:** Automatically delete task results from Redis after 1 hour (3600 seconds)

**Rationale:**

* **Redis Memory Management:** Prevents unbounded result storage
* **1 Hour:** Sufficient for API result retrieval and debugging
* **Automatic Cleanup:** No manual intervention required
* **Storage Cost:** Reduces Redis memory footprint


Result Backend Max Retries
~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Setting:** ``result_backend_max_retries = 3``

**Purpose:** Retry failed result backend operations (storing task results in Redis)

**Rationale:**

* **Transient Failures:** Network blips or Redis temporary unavailability
* **3 Retries:** Balance between persistence and failing fast
* **Automatic Recovery:** Tasks succeed even if Redis hiccups
* **Exponential Backoff:** Retries use increasing delays


Broker Pool Limit
~~~~~~~~~~~~~~~~~

**Setting:** ``broker_pool_limit = 10``

**Purpose:** Connection pool size for broker connections

**Rationale:**

* **Connection Reuse:** Avoid creating new connections per operation
* **10 Connections:** Sufficient for typical worker concurrency
* **Resource Limit:** Prevents connection exhaustion on Redis


Redis Max Connections
~~~~~~~~~~~~~~~~~~~~~

**Setting:** ``redis_max_connections = 50``

**Purpose:** Maximum Redis connections per worker process

**Rationale:**

* **Connection Limit:** Prevents worker from exhausting Redis connections
* **50 Connections:** Supports high concurrency scenarios
* **Shared Limit:** Applies to broker + result backend


Celery Autoscaling
------------------

Celery's built-in autoscaling dynamically adjusts task concurrency within each worker based on queue depth. This is the primary scaling mechanism for Ibutsu workers.


Environment Variables
~~~~~~~~~~~~~~~~~~~~~

The worker's CMD line uses bash parameter expansion to configure autoscaling:

.. code-block:: dockerfile

   CMD ["celery", "--app", "ibutsu_server:worker_app", "worker",
        "--pool=${CELERY_POOL:-gevent}",
        "${CELERY_AUTOSCALE:+--autoscale=${CELERY_AUTOSCALE}}",
        "${CELERY_AUTOSCALE:---concurrency=${CELERY_CONCURRENCY:-4}}"]

**Parameter expansion explained:**

* ``${CELERY_AUTOSCALE:+--autoscale=${CELERY_AUTOSCALE}}``

  - If ``CELERY_AUTOSCALE`` is set → expands to ``--autoscale=<value>``
  - If ``CELERY_AUTOSCALE`` is unset → expands to nothing

* ``${CELERY_AUTOSCALE:---concurrency=${CELERY_CONCURRENCY:-4}}``

  - If ``CELERY_AUTOSCALE`` is unset → expands to ``--concurrency=<value>``
  - If ``CELERY_AUTOSCALE`` is set → expands to nothing
  - Default concurrency: ``4`` if ``CELERY_CONCURRENCY`` also unset

**Mutually exclusive behavior:** Either autoscaling OR fixed concurrency is used, never both.

Configuration Options
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Autoscaling (recommended for production)
   CELERY_POOL=gevent
   CELERY_AUTOSCALE=20,2          # Format: max,min

   # Fixed concurrency (simpler, less adaptive)
   CELERY_POOL=gevent
   CELERY_CONCURRENCY=10          # Fixed at 10 concurrent tasks

   # Defaults (if no env vars set)
   # CELERY_POOL defaults to gevent
   # CELERY_CONCURRENCY defaults to 4

Tuning Autoscale Values
~~~~~~~~~~~~~~~~~~~~~~~~

**Format:** ``CELERY_AUTOSCALE=max,min``

**Choosing max value:**

* **Low traffic (< 100 tasks/min):** ``10,2``
* **Medium traffic (100-500 tasks/min):** ``20,2`` or ``20,4``
* **High traffic (> 500 tasks/min):** ``30,10``

**Considerations:**

* **Gevent pool:** Can handle higher max values (20-30) due to low memory overhead
* **Memory limits:** ``max × avg_task_memory`` should fit within pod memory limit
* **Connection pools:** Ensure ``broker_pool_limit`` ≥ max value

**Choosing min value:**

* **Low min (1-2):** Saves resources during idle periods
* **High min (5-10):** Faster response to sudden load spikes
* **Trade-off:** Idle resource usage vs. scale-up latency

Monitoring Autoscaling
~~~~~~~~~~~~~~~~~~~~~~

**Key metrics to watch:**

* **Active tasks:** Current concurrent task count (should vary between min/max)
* **Queue depth:** Number of pending tasks (triggers scale-up)
* **Task latency:** Time from enqueue to execution (indicates if scaling is sufficient)
* **Memory usage:** Should stay within limits even at max concurrency

**Using Flower:**

Access the Flower dashboard to monitor real-time autoscaling behavior:

* **Workers view:** Shows current concurrency per worker
* **Tasks view:** Shows active, queued, and completed task counts
* **Monitor view:** Live graph of task execution

**Indicators autoscaling is working:**

* Concurrency increases when tasks queue
* Concurrency decreases during idle periods
* Task latency remains low (< 5 seconds)
* Memory stays within pod limits

**Indicators to adjust settings:**

* **Queue depth consistently high:** Increase max value or add more worker replicas
* **Frequent OOMKills:** Decrease max value or increase memory limits
* **Slow response to load:** Increase min value for faster readiness

General Tuning Guidelines
~~~~~~~~~~~~~~~~~~~~~~~~~~

**Right-sizing autoscale values:**

1. **Start conservatively:** Begin with ``20,2`` for gevent
2. **Monitor queue depth:** If consistently > 10, increase max
3. **Check memory usage:** Ensure peak usage < 80% of limit
4. **Adjust gradually:** Change one parameter at a time

**Memory calculation:**

* Gevent: ``max_concurrency × 15MB + 200MB base`` ≈ ``20 × 15 + 200 = 500MB``
* Add 30% buffer: ``500MB × 1.3 = 650MB`` → set limit to ``768Mi``

**Connection pool sizing:**

* ``broker_pool_limit`` should be ≥ autoscale max
* ``redis_max_connections`` should be ≥ ``autoscale_max + 10``

Monitoring and Observability
-----------------------------

Key Metrics
~~~~~~~~~~~

**Celery Worker Metrics (via Flower):**

* **Active tasks:** Current concurrent task count per worker
* **Queue depth:** Number of pending tasks (triggers autoscaling)
* **Task throughput:** Tasks completed per minute
* **Task failures:** Failure rate and error types
* **Task duration:** Average and P95 execution time

**Worker Resource Metrics:**

* **Memory usage:** Current vs limits (watch for OOMKills)
* **CPU usage:** Current vs requests/limits
* **Autoscale state:** Current concurrency (should vary between min/max)

**Redis Metrics:**

* **Memory usage:** Should stay within available memory
* **Connected clients:** Should not exceed ``redis_max_connections``
* **Queue length:** Indicates backlog (``LLEN celery``)

Flower Dashboard
~~~~~~~~~~~~~~~~

Flower provides a web UI for monitoring Celery workers at ``http://<flower-service>:5555``

**Essential views:**

* **Workers:** Shows current autoscale concurrency per worker
* **Tasks:** Real-time task execution and history
* **Monitor:** Live task execution graph
* **Broker:** Queue depth and status

**Setup:**

.. code-block:: bash

   # Set authentication
   export FLOWER_BASIC_AUTH=username:password

   # Start Flower
   celery --app ibutsu_server:worker_app flower


Troubleshooting
---------------

Queue Depth Growing
~~~~~~~~~~~~~~~~~~~

**Symptoms:** Tasks queue faster than workers process them, increasing latency

**Causes:**

* Autoscale max insufficient for current load
* Task duration too long
* Too few worker replicas

**Solutions:**

1. **Increase autoscale max:** Allow more concurrent tasks (e.g., ``20,2`` → ``30,4``)
2. **Add worker replicas:** More pods to distribute load
3. **Optimize slow tasks:** Reduce per-task execution time
4. **Check worker health:** Ensure workers aren't stuck or erroring

**Quick check:**

.. code-block:: bash

   # Check queue depth via Redis
   kubectl exec -it <redis-pod> -- redis-cli -a <password> llen celery

   # Check worker autoscale state in Flower
   # View current concurrency per worker (should approach max if queue is growing)

Autoscaling Not Working
~~~~~~~~~~~~~~~~~~~~~~~~

**Symptoms:** Worker concurrency stays at min value despite queued tasks

**Causes:**

* ``CELERY_AUTOSCALE`` not set (using fixed concurrency instead)
* Broker connection issues
* Worker configuration error

**Solutions:**

1. **Verify environment variable:** Ensure ``CELERY_AUTOSCALE`` is set (not ``CELERY_CONCURRENCY``)
2. **Check worker logs:** Look for autoscaler messages
3. **Restart workers:** Force reload of configuration

**Quick check:**

.. code-block:: bash

   # Verify autoscale is configured
   kubectl exec -it <worker-pod> -- env | grep CELERY_AUTOSCALE

   # Check worker startup command
   kubectl exec -it <worker-pod> -- ps aux | grep celery

Related Documentation
---------------------

**Ibutsu-specific:**

* ``celery_utils.py`` - Contains the worker performance settings documented here
* ``backend/tasks/`` - Celery task implementations

**External resources:**

* `Celery Workers Guide <https://docs.celeryq.dev/en/stable/userguide/workers.html>`_ - Official worker documentation
* `Celery Optimizing <https://docs.celeryq.dev/en/stable/userguide/optimizing.html>`_ - Performance tuning guide
* `Celery Autoscaling <https://docs.celeryq.dev/en/stable/userguide/workers.html#autoscaling>`_ - Autoscaling documentation
