.. _developer-guide/getting-started:

Getting Started
===============

Requirements
------------

To run the server locally, you will need the following installed:

- Python 3.9+
- NodeJS
- yarn
- redis (strongly recommend a container)
- PostgreSQL (strongly recommend a container)

To run the containers, you will need either one of the following installed:

- Docker and Docker Compose
- Podman

Note when using Podman 5+, default networking will not resolve ``localhost``, and ``127.0.0.1`` should be used.

Running Locally
---------------

To run the server locally for development, you can use ``podman`` or ``docker-compose``.

podman
^^^^^^

To run Ibutsu using ``podman``, use the ``ibutsu-pod.sh`` utility script:

.. code-block:: shell

   $ ./scripts/ibutsu-pod.sh --create-admin --create-project

This will start up the containers and create an administrator and a project.

If you want to persistent the data in the containers, use the ``--persistent`` option:

.. code-block:: shell

   $ ./scripts/ibutsu-pod.sh --persistent

By default the script stores persistent data in two directories, ``.postgres-data`` and ``.redis-data``.
If you would prefer to use ``podman`` volumes, specify the ``--use-volumes`` option:

.. code-block:: shell

   $ ./scripts/ibutsu-pod.sh --persistent --use-volumes

To see all the options provided by the ``ibutsu-pod.sh`` script, use the ``-h`` option:

.. code-block:: shell

   $ ./scripts/ibutsu-pod.sh -h
   Usage: ibutsu-pod.sh [-h|--help] [-p|--persistent] [-V|--use-volumes] [-A|--create-admin] [-P|--create-project] [POD_NAME]

   optional arguments:
     -h, --help            show this help message
     -p, --persistent      persist the data in the containers
     -V, --use-volumes     use podman volumes to store data
     -A, --create-admin    create an administrator ('admin@example.com')
     -P, --create-project  create a default project ('my-project')
     POD_NAME              the name of the pod, 'ibutsu' if ommitted


Docker Compose
^^^^^^^^^^^^^^

There is a pre-created Docker Compose file for running a development environment locally.

The ``docker-compose.dev.yaml`` file will run python containers and do a local install for backend and frontend.

The ``docker-compose.yaml`` file will build containers using the appropriate dockerfiles and run the built images.

.. code-block:: shell

   $ docker-compose -f docker-compose.dev.yaml
   # OR
   $ docker-compose -f docker-compose.yaml

Without Containers
^^^^^^^^^^^^^^^^^^

Using either ``podman`` or Docker Compose is the recommended way to run Ibutsu locally. If you don't
want to use the containers, the following instructions should help you get up and running:

Run the Frontend
~~~~~~~~~~~~~~~~

When running on your local computer, the server is made up of two parts, the frontend and the
backend. The backend runs the api while the frontend hosts the UI.
First, install yarn if you don't have it already, and set up the frontend.

Many Linux distributions offer Yarn in their package repositories. Both Debian and Fedora package
Yarn as ``yarnpkg``.

Install Yarn on Fedora:

.. code-block:: shell

   sudo dnf install -y yarnpkg

Install Yarn on Debian:

.. code-block:: shell

   sudo apt install yarnpkg


If you don't wnat to use the packaged version of Yarn, you can install it via ``npm``:

.. code-block:: shell

    cd ibutsu-server/frontend
    npm install yarn

Just remember that you'll need to specify the full path when running Yarn:

.. code-block:: shell

    node_modules/.bin/yarn <action>

Now that Yarn is installed, use Yarn to install the frontend's dependencies:

.. code-block:: shell

   yarn install

Then to start the development server for the frontend using yarn:

.. code-block:: shell

    yarn run devserver


The development server features automatic reloading, so that whenever you make a change to your
code, the server will rebuild your app and run the new code.

Open your browser and go to `localhost:3000 <http://localhost:3000/>`_ to see the web UI.

Run PostgreSQL and Redis
~~~~~~~~~~~~~~~~~~~~~~~~

Next you'll need to set up a PostgreSQL server. It is easiest to just run the server in a
container:

.. note::

    In all these examples, we use ``podman``, but you can substitute ``docker`` in its place.


.. code:: shell

    podman run --publish 5432:5432 --name postgres -e POSTGRES_USER=ibutsu -e POSTGRES_PASSWORD=ibutsu -e POSTGRES_DB=ibutsu -d postgres


If you don't have redis installed locally, you'll want to also run a redis container.
This is required for ``celery``.

.. code:: shell

    podman run --name redis -d -p "6379:6379" redis


Install Dependencies
~~~~~~~~~~~~~~~~~~~~

You'll want to set up a virtual environment for the backend, and install the dependencies:

.. code:: shell

    cd ibutsu-server/backend
    python3.9 -m venv .ibutsu-env
    source .ibtusu-env/bin/activate/
    pip install -U pip wheel
    pip install -U .


Run Celery Worker
~~~~~~~~~~~~~~~~~

Start the celery worker using the ``backend/celery_worker.sh`` script or via:

.. code:: shell

    celery worker -E -A ibutsu_server.tasks.queues:app --loglevel=info


.. note::

    The ``-E`` is necessary to send task related events to the celery task monitor.


(Optional) Start the celery task monitor:

.. code:: shell

    .ibutsu-env/bin/python ibutsu_server/tasks/monitor.py


The task monitor checks the task queue for failures.


Run the API Backend
~~~~~~~~~~~~~~~~~~~

Create ``backend/settings.yaml``, start with copying ``backend/default.settings.yaml``

.. code:: shell

    cp backend/default.settings.yaml backend/settings.yaml

Run the Ibutsu server backend using Python:

.. code:: shell

    .ibutsu-env/bin/python -m ibutsu_server

By default, the backend runs on port ``8080``, so your backend URL will be http://localhost:8080
