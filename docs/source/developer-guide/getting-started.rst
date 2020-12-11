.. _developer-guide/getting-started:

Getting Started
===============

Requirements
------------

To run the server locally, you will need the following installed:

- Python 3.6+
- NPM
- yarn
- redis (strongly recommend a container)
- PostgreSQL (strongly recommend a container)

To run the containers, you will need either one of the following installed:

- Docker
- Podman

Run the Frontend
----------------

When running on your local computer, the server is made up of two parts, the frontend and the
backend. The backend runs the api while the frontend hosts the UI.
First, install yarn if you don't have it already, and set up the frontend.

Many Linux distributions offer Yarn in their package repositories. Both Debian and Fedora package
Yarn as ``yarnpkg``.

Install Yarn on Fedora::

   sudo dnf install -y yarnpkg

Install Yarn on Debian::

   sudo apt install yarnpkg


If you don't wnat to use the packaged version of Yarn, you can install it via ``npm``::

    cd ibutsu-server/frontend
    npm install yarn

Just remember that you'll need to specify the full path when running Yarn::

    node_modules/.bin/yarn <action>

Now that Yarn is installed, use Yarn to install the frontend's dependencies::

   yarn install

Then to start the development server for the frontend using yarn::

    yarn run devserver


The development server features automatic reloading, so that whenever you make a change to your
code, the server will rebuild your app and run the new code.

Open your browser and go to `localhost:3000 <http://localhost:3000/>`_ to see the web UI.

Run PGSQL and Redis
---------------------

Next you'll need to set up a PostgreSQL server. It is easiest to just run the server in a
container:

.. note::

    In all these examples, we use ``podman``, but you can substitute ``docker`` in its place.


.. code:: bash

    podman run --publish 5432:5432 --name postgres -e POSTGRES_USER=ibutsu -e POSTGRES_PASSWORD=ibutsu -e POSTGRES_DB=ibutsu -d postgres


If you don't have redis installed locally, you'll want to also run a redis container.
This is required for ``celery``.

.. code:: bash

    podman run --name redis -d -p "6379:6379" redis


Install Dependencies
--------------------

You'll want to set up a virtual environment for the backend, and install the dependencies:

.. code:: bash

    cd ibutsu-server/backend
    virtualenv .ibutsu-env --python python3
    .ibutsu-env/bin/pip install -r requirements.txt


Run Celery Worker
-----------------

Start the celery worker using the ``backend/celery_worker.sh`` script or via:

.. code:: bash

    celery worker -E -A ibutsu_server.tasks.queues:app --loglevel=info


.. note::

    The ``-E`` is necessary to send task related events to the celery task monitor.


(Optional) Start the celery task monitor:

.. code:: bash

    .ibutsu-env/bin/python ibutsu_server/tasks/monitor.py


The task monitor checks the task queue for failures.


Run the API Backend
-------------------

Run the Ibutsu server backend using Python:

.. code:: bash

    .ibutsu-env/bin/python -m ibutsu_server

By default, the backend runs on port ``8080``, so your backend URL will be http://localhost:8080
