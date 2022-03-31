# Ibutsu Server
![tests](https://github.com/ibutsu/ibutsu-server/actions/workflows/tests.yaml/badge.svg?branch=master)
[![Documentation Status](https://readthedocs.org/projects/ibutsu/badge/?version=latest)](https://docs.ibutsu-project.org/en/latest/?badge=latest)

Ibutsu is a test result reporting and artifact storage system. Ibutsu gives your team the ability to
post their test results and artifacts to the server through the API, and query them using the web
user interface.

## About the API

Ibutsu has a RESTful API built using the [OpenAPI specification](https://github.com/swagger-api/swagger-core/wiki)
which is browseable from `/api/ui/`

## Running locally

To run the server locally for development, you can use `podman` or Docker Compose.

### `podman`

To run Ibutsu using `podman`, use the `ibutsu-pod.sh` utility script:

```console
./script/ibutsu-pod.sh --create-admin --create-project
```

This will start up the containers and create an administrator and a project.

If you want to persistent the data in the containers, use the `--persistent` option:

```console
./scripts/ibutsu-pod.sh --persistent
```

By default the script stores persistent data in two directories, `.postgres-data` and `.redis-data`.
If you would prefer to use `podman` volumes, specify the `--use-volumes` option:

```console
./scripts/ibutsu-pod.sh --persistent --use-volumes
```

To see all the options provided by the `ibutsu-pod.sh` script, use the `-h` option:

```console
./scripts/ibutsu-pod.sh -h
Usage: ibutsu-pod.sh [-h|--help] [-p|--persistent] [-V|--use-volumes] [-A|--create-admin] [-P|--create-project] [POD_NAME]

optional arguments:
  -h, --help            show this help message
  -p, --persistent      persist the data in the containers
  -V, --use-volumes     use podman volumes to store data
  -A, --create-admin    create an administrator ('admin@example.com')
  -P, --create-project  create a default project ('my-project')
  POD_NAME              the name of the pod, 'ibutsu' if ommitted

```

### Docker Compose

There is a pre-created Docker Compose file for running a development environment locally:

```console
docker-compose -f docker-compose.dev.yaml
```

### Without containers

Using either `podman` or Docker Compose is the recommended way to run Ibutsu locally. If you don't
want to use the containers, the following must be installed:

- Python 3.8+
- NodeJS
- yarn
- redis (strongly recommend a container)
- PostgreSQL (strongly recommend a container)

## Container images

Container images for Ibutsu are provided at [quay.io/organization/ibutsu](https://quay.io/organization/ibutsu).

**Frontend:**
[![Frontend](https://quay.io/repository/ibutsu/frontend/status "Frontend")](https://quay.io/repository/ibutsu/frontend)
**Backend:**
[![Backend](https://quay.io/repository/ibutsu/backend/status "Backend")](https://quay.io/repository/ibutsu/backend)
**Worker:**
[![Worker](https://quay.io/repository/ibutsu/worker/status "Worker")](https://quay.io/repository/ibutsu/worker)
**Scheduler:**
[![Scheduler](https://quay.io/repository/ibutsu/scheduler/status "Scheduler")](https://quay.io/repository/ibutsu/scheduler)


## Documentation

Please visit [Ibutsu's Documentation](https://docs.ibutsu-project.org/) for more information.
