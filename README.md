# Ibutsu Server

Ibutsu is a test result reporting and artifact storage system. Ibutsu gives your team the ability to
post their test results and artifacts to the server through the API, and query them using the web
user interface.

## About the API

Ibutsu has a RESTful API built using the [OpenAPI specification](https://github.com/swagger-api/swagger-core/wiki)
which is browseable from `/api/ui/`

## Requirements

To run the server locally, you will need the following installed:

- Python 3.6+
- NPM
- yarn
- redis (either in docker or installed on your local machine)
- mongo (strongly recommend docker)

Additionally, to run the Docker containers, you will need the following installed:

- Docker
- Docker Compose

## Running locally (for development)

When running on your local computer, the server is made up of two parts, the frontend and the
backend. The backend runs the api while the frontend hosts the UI.
First, install yarn if you don't have it already, and set up the frontend.

```
$ cd ibutsu-server/frontend
$ npm install yarn
$ node_modules/.bin/yarn install
```

Then to start the frontend using yarn:

```
$ node_modules/.bin/yarn start
```

Additionally you can run the frontend in dev-mode, which will automatically pull in updates
to the framework on-the-fly.
```
$ node_modules/.bin/yarn run devserver
```

Next you'll need to set up a MongoDB server. The easiest is to just run a MongoDB server in a Docker
container:

```
$ docker run --name mongo -d -p "27017:27017" mongo
```

If you don't have redis installed locally, you'll want to also run a redis container.
This is required for `celery`.
```
$ docker run --name redis -d -p "6379:6379" redis
```

You'll want to set up a virtual environment for the backend, and install the dependencies:

```
$ cd ibutsu-server/backend
$ virtualenv .ibutsu-env --python python3
$ .ibutsu-env/bin/pip install -r requirements.txt
```

Start the celery worker using the `backend/celery_worker.sh` script or via:
```
celery worker -E -B -A ibutsu_server.tasks.queues:app --loglevel=info
```
Note: the `-E` is necessary to send task related events to the celery task monitor.
The optional `-B` is necessary for the celery worker to run any periodic tasks. Note in production, it is
recommended to run `celery beat` separately from the worker. For more information, take a look at the [Celery documentation](https://docs.celeryproject.org/en/stable/userguide/periodic-tasks.html#starting-the-scheduler).

(Optional) Start the celery task monitor:
```
.ibutsu-env/bin/python ibutsu_server/tasks/monitor.py
```
The task monitor checks the task queue for failures.

Run the Ibutsu server backend using Python:

```
$ .ibutsu-env/bin/python -m ibutsu_server
```

Open your browser and go to http://localhost:3000/ to see the web UI.

## Running in Docker (with Docker Compose)

To run Ibutsu in Docker, you'll need to install Docker Compose.

With Docker Compose installed, you need to build the images:

```
$ docker-compose build
```

Then you can run all the containers:

```
$ docker-compose up -d
```

Then open your browser to http://localhost:8080/

## Viewing the API UI

To view the API UI when running the server locally, go to http://localhost:8080/api/ui/

To view the API UI when running the server in Docker, go to http://localhost:8081/api/ui/
