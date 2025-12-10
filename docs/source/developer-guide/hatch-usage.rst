Hatch Usage Guide
=================

This document explains how to use Hatch for development and testing of the ibutsu-server backend.

Prerequisites
-------------

* Python 3.9+ installed
* Hatch installed (``pip install hatch``)

Available Environments
----------------------

Default Environment
~~~~~~~~~~~~~~~~~~~

The default environment uses Python 3.9 and includes basic dependencies for development:

.. code-block:: bash

   # Create and activate the default environment
   hatch shell

   # Run tests
   hatch run test

   # Run tests with coverage
   hatch run test-cov

   # Generate coverage report
   hatch run cov-report

   # Generate XML coverage report (for CI/codecov)
   hatch run cov-xml

   # Generate HTML coverage report
   hatch run cov-html

   # Run all coverage commands together
   hatch run cov

   # Run linting with pre-commit
   hatch run lint

   # Run linting with diff output
   hatch run lint-check

Test Environment Matrix
~~~~~~~~~~~~~~~~~~~~~~~~

The test environment supports multiple Python versions (3.9, 3.10, 3.11) with additional test dependencies:

.. code-block:: bash

   # Run tests on all Python versions
   hatch run test:run

   # Run tests with coverage on all Python versions
   hatch run test:run-cov

   # Run tests on specific Python version
   hatch run test.py3.9:run
   hatch run test.py3.10:run
   hatch run test.py3.11:run

   # Generate coverage reports in test environment
   hatch run test:cov-report
   hatch run test:cov-xml
   hatch run test:cov-html

   # Run full coverage workflow
   hatch run test:cov

Common Commands
---------------

Running Tests
~~~~~~~~~~~~~

.. code-block:: bash

   # Run all tests (uses pytest with -n 4 for parallel execution)
   hatch run test

   # Run specific test file
   hatch run test tests/test_health_controller.py

   # Run tests with specific options
   hatch run test -x -v  # Stop on first failure, verbose output

   # Run tests without parallel execution
   hatch run test -n 0

Development Workflow
~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Enter development shell
   hatch shell

   # Run linting before committing (uses pre-commit)
   hatch run lint

   # Run tests with coverage and generate reports
   hatch run test-cov
   hatch run cov-report

   # Or run the full coverage workflow
   hatch run cov

Environment Management
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Show available environments
   hatch env show

   # Remove all environments (clean slate)
   hatch env prune

   # Create specific environment
   hatch env create test.py3.9
   hatch env create test.py3.10
   hatch env create test.py3.11

Configuration Details
---------------------

Default Environment
~~~~~~~~~~~~~~~~~~~

* **Python Version:** 3.9
* **Extra Dependencies:** psycopg2-binary
* **Scripts:** test, test-cov, cov-report, cov-xml, cov-html, cov, lint, lint-check

Test Environment
~~~~~~~~~~~~~~~~

* **Python Versions:** 3.9, 3.10, 3.11 (matrix)
* **Extra Dependencies:** psycopg2-binary, Flask-Testing, coverage[toml], pytest-xdist
* **Scripts:** run, run-cov, cov-report, cov-xml, cov-html, cov

Test Configuration (pytest)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* **Test Paths:** tests/
* **Parallel Execution:** 4 workers by default (pytest-xdist)
* **Traceback Style:** short

Coverage Configuration
~~~~~~~~~~~~~~~~~~~~~~

* **Source:** ibutsu_server
* **Branch Coverage:** Enabled
* **Omit:** tests, __pycache__, migrations
* **XML Output:** coverage.xml
* **HTML Output:** htmlcov/

Linting Configuration
~~~~~~~~~~~~~~~~~~~~~

* **Tool:** pre-commit (runs Ruff and other checks)
* **Ruff Line Length:** 100
* **Enabled Rules:** E, W, F, I, UP, B, C4, N, S, T20, PT, RET, SIM, ARG, PTH, ERA, PL, RUF

Notes
-----

* The configuration automatically uses ``psycopg2-binary`` to avoid compilation issues
* All test dependencies are automatically installed when using hatch environments
* The existing ``test_env`` virtual environment can still be used alongside hatch
* Hatch environments are isolated and don't interfere with your system Python
* Tests run with 4 parallel workers by default for faster execution
* Pre-commit hooks are used for linting (install with ``pre-commit install``)
