# Ibutsu Server

## Status

[![Tests](https://github.com/ibutsu/ibutsu-server/actions/workflows/tests.yaml/badge.svg?branch=main)](https://github.com/ibutsu/ibutsu-server/actions/workflows/tests.yaml)
[![Documentation Status](https://readthedocs.org/projects/ibutsu/badge/?version=latest)](https://docs.ibutsu-project.org/en/latest/?badge=latest)

### Test Coverage

[![codecov](https://codecov.io/gh/ibutsu/ibutsu-server/branch/main/graph/badge.svg)](https://codecov.io/gh/ibutsu/ibutsu-server)
[![Backend Coverage](https://codecov.io/gh/ibutsu/ibutsu-server/branch/main/graph/badge.svg?flag=backend)](https://codecov.io/gh/ibutsu/ibutsu-server/tree/main/backend)
[![Frontend Coverage](https://codecov.io/gh/ibutsu/ibutsu-server/branch/main/graph/badge.svg?flag=frontend)](https://codecov.io/gh/ibutsu/ibutsu-server/tree/main/frontend)

| Component | Lines | Statements | Functions | Branches | Target |
|-----------|-------|------------|-----------|----------|--------|
| Frontend  | ≥7%   | ≥7%        | ≥4%       | ≥5%      | 10%    |
| Backend   | ≥60%  | ≥60%       | ≥60%      | ≥60%     | 60%    |

**Coverage Thresholds:**
- **Backend:** Minimum 60% coverage enforced in CI to maintain code quality
- **Frontend:** Minimum thresholds (Lines: 7%, Statements: 7%, Functions: 4%, Branches: 5%) enforced to prevent regression

*Coverage reports are automatically generated and uploaded to [Codecov](https://codecov.io/gh/ibutsu/ibutsu-server) on every CI run. See [frontend/TESTING.md](frontend/TESTING.md) for improvement goals and testing guidelines.*

Ibutsu is a test result reporting and artifact storage system. Ibutsu gives your team the ability to
post their test results and artifacts to the server through the API, and query them using the web
user interface.

## About the API

Ibutsu has a RESTful API built using the [OpenAPI specification](https://github.com/swagger-api/swagger-core/wiki)
which is browseable from `/api/ui/`

## Running locally

To run the server locally for development, you can use `podman` or docker/podman-Compose.

### `podman`

To run Ibutsu using `podman`, use the `ibutsu-pod.sh` utility script:

```console
./scripts/ibutsu-pod.sh --create-admin --create-project
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
docker-compose -f docker-compose.dev.yml up
```

### Without containers

Using either `podman` or Docker Compose is the recommended way to run Ibutsu locally. If you don't
want to use the containers, the following must be installed:

- Python 3.9+
- NodeJS
- yarn
- redis (strongly recommend a container)
- PostgreSQL (strongly recommend a container)

## Development

### OpenAPI Schema Validation

The project includes pre-commit hooks for code quality and validation, including OpenAPI schema validation. The OpenAPI specification is validated using the OpenAPI Generator CLI to ensure it's compatible with client generation tools.

To set up pre-commit hooks:

```console
pre-commit install
```

To run all pre-commit hooks manually:

```console
pre-commit run --all-files
```

To run only the OpenAPI validation:

```console
pre-commit run openapi-validate --all-files
```

Or run the validation script directly:

```console
./scripts/validate-openapi.sh
```

The validation uses the OpenAPI Generator CLI v7.15.0 and requires either `podman` or `docker` to be available. The pre-commit hook is configured as a local script with no additional Python dependencies.

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

**Build Configuration:**
- Pull request builds are validated in GitHub Actions CI
- Main branch image builds are triggered automatically via Quay.io repository build triggers


## Documentation

Please visit [Ibutsu's Documentation](https://docs.ibutsu-project.org/) for more information.
