#!/bin/bash

# Some variables
POD_NAME="ibutsu"
JWT_SECRET=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
IS_PERSISTENT=false
USE_VOLUMES=false
CREATE_ADMIN=false
CREATE_PROJECT=false
POSTGRES_EXTRA_ARGS=
REDIS_EXTRA_ARGS=
BACKEND_EXTRA_ARGS=
PYTHON_IMAGE=python:3.9

function print_usage() {
    echo "Usage: ibutsu-pod.sh [-h|--help] [-p|--persistent] [-V|--use-volumes] [-A|--create-admin] [-P|--create-project] [POD_NAME]"
    echo ""
    echo "optional arguments:"
    echo "  -h, --help            show this help message"
    echo "  -p, --persistent      persist the data in the containers"
    echo "  -V, --use-volumes     use podman volumes to store data"
    echo "  -A, --create-admin    create an administrator ('admin@example.com')"
    echo "  -P, --create-project  create a default project ('my-project')"
    echo "  POD_NAME              the name of the pod, 'ibutsu' if ommitted"
    echo ""
}

# Parse the arguments
for ARG in $*; do
    if [[ "$ARG" == "-p" ]] || [[ "$ARG" == "--persistent" ]]; then
        IS_PERSISTENT=true
    elif [[ "$ARG" == "-V" ]] || [[ "$ARG" == "--use-volumes" ]]; then
        USE_VOLUMES=true
    elif [[ "$ARG" == "-A" ]] || [[ "$ARG" == "--create-admin" ]]; then
        CREATE_ADMIN=true
    elif [[ "$ARG" == "-P" ]] || [[ "$ARG" == "--create-project" ]]; then
        CREATE_PROJECT=true
    elif [[ "$ARG" == "-h" ]] || [[ "$ARG" == "--help" ]]; then
        print_usage
        exit 0
    else
        POD_NAME=$ARG
    fi
done

# Check this is being run in the correct directory
DIRS=`ls -p | grep '/'`
if [[ ! ${DIRS[*]} =~ "backend" ]] && [[ ! ${DIRS[*]} =~ "frontend" ]]; then
    echo "This script needs to be run from the root of the project"
    exit 1
fi

# If the data is persistent, check if there's a JWT secret in a file, or save it
if [[ $IS_PERSISTENT = true ]]; then
    if [[ ! -f ".jwtsecret" ]]; then
        echo $JWT_SECRET > .jwtsecret
    else
        JWT_SECRET=$(<.jwtsecret)
    fi
fi

# Persist the data
if [[ $IS_PERSISTENT = true ]]; then
    POSTGRES_EXTRA_ARGS+=' -e PGDATA=/var/lib/postgres/data/pgdata'
    if [[ $USE_VOLUMES = true ]]; then
        podman volume exists postgres-data > /dev/null
        PG_VOLUME_EXISTS=$?
        podman volume exists redis-data > /dev/null
        RD_VOLUME_EXISTS=$?
        if [[ $PG_VOLUME_EXISTS -eq 1 ]]; then
            podman volume create postgres-data > /dev/null
        fi
        if [[ $RD_VOLUME_EXISTS -eq 1 ]]; then
            podman volume create redis-data > /dev/null
        fi
        POSTGRES_EXTRA_ARGS+=' -v postgres-data:/var/lib/postgres/data:Z'
        REDIS_EXTRA_ARGS+=' -v redis-data:/data:Z'
    else
        POSTGRES_EXTRA_ARGS+=' -v ./.postgres-data:/var/lib/postgres/data:Z'
        REDIS_EXTRA_ARGS+=' -v ./.redis-data:/data:Z'
    fi
    if [[ ! -d ".postgres-data" ]]; then
        mkdir .postgres-data
    fi
    if [[ ! -d ".redis-data" ]]; then
        mkdir .redis-data
    fi
fi

# Create the administrator
if [[ $CREATE_ADMIN = true ]]; then
    BACKEND_EXTRA_ARGS+=' -e IBUTSU_SUPERADMIN_EMAIL=admin@example.com -e IBUTSU_SUPERADMIN_PASSWORD=admin12345 -e IBUTSU_SUPERADMIN_NAME=Administrator'
fi

# Print out a quick summary of actions
echo "Summary of actions:"
if [[ $IS_PERSISTENT = true ]]; then
    if [[ $USE_VOLUMES = true ]]; then
        echo "  Using volumes for persistent storage"
    else
        echo "  Using directories for persistent storage"
    fi
fi
if [[ $CREATE_ADMIN = true ]]; then
    echo "  Administrator will be created"
fi
if [[ $CREATE_PROJECT = true ]]; then
    echo "  Project will be created"
fi
echo "Stop the pod by running: 'podman pod rm -f ${POD_NAME}'"
echo ""

# Get the pods up and running
echo -n "Creating ibutsu pod:    "
podman pod create -p 8080:8080 -p 3000:3000 --name $POD_NAME
echo "done."
echo -n "Adding postgres to the pod:    "
podman run -dt \
       --pod $POD_NAME \
       -e POSTGRES_USER=ibutsu \
       -e POSTGRES_DB=ibutsu \
       -e POSTGRES_PASSWORD=ibutsu \
       $POSTGRES_EXTRA_ARGS \
       --name ibutsu-postgres \
       --rm \
       postgres:15
echo "done."
echo -n "Adding redis to the pod:    "
podman run -dt \
       --pod $POD_NAME \
       $REDIS_EXTRA_ARGS \
       --name ibutsu-redis \
       --rm \
       redis:latest
echo "done."
echo -n "Adding backend to the pod:    "
podman run -d \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-backend \
       -e JWT_SECRET=$JWT_SECRET \
       -e POSTGRESQL_HOST=127.0.0.1 \
       -e POSTGRESQL_PORT=5432 \
       -e POSTGRESQL_DATABASE=ibutsu \
       -e POSTGRESQL_USER=ibutsu \
       -e POSTGRESQL_PASSWORD=ibutsu \
       -e CELERY_BROKER_URL=redis://127.0.0.1:6379 \
       -e CELERY_RESULT_BACKEND=redis://127.0.0.1:6379 \
       $BACKEND_EXTRA_ARGS \
       -w /mnt \
       -v./backend:/mnt/:z \
       $PYTHON_IMAGE \
       /bin/bash -c 'python -m venv .backend_env && source .backend_env/bin/activate &&
                     pip install -U pip wheel &&
                     pip install . &&
                     python -m ibutsu_server --host 0.0.0.0'
echo "done."
echo -n "Waiting for backend to respond: "
until $(curl --output /dev/null --silent --head --fail http://127.0.0.1:8080); do
  echo -n '.'
  sleep 5
done
echo "backend up."
# Note the COLUMNS=80 env var is for https://github.com/celery/celery/issues/5761
echo -n "Adding celery worker to the pod:    "
podman run -d \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-worker \
       -e COLUMNS=80 \
       -e POSTGRESQL_HOST=127.0.0.1 \
       -e POSTGRESQL_PORT=5432 \
       -e POSTGRESQL_DATABASE=ibutsu \
       -e POSTGRESQL_USER=ibutsu \
       -e POSTGRESQL_PASSWORD=ibutsu \
       -e CELERY_BROKER_URL=redis://127.0.0.1:6379 \
       -e CELERY_RESULT_BACKEND=redis://127.0.0.1:6379 \
       -w /mnt \
       -v./backend:/mnt/:z \
       $PYTHON_IMAGE \
       /bin/bash -c 'pip install -U pip wheel &&
                     pip install . &&
                     ./celery_worker.sh'
echo "done."
echo -n "Adding frontend to the pod:    "
podman run -d \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-frontend \
       -w /mnt \
       -v./frontend:/mnt/:Z \
       node:18 \
       /bin/bash -c "npm install --no-save --no-package-lock yarn &&
         yarn install &&
         CI=1 yarn devserver"
echo "done."
echo -n "Waiting for frontend to respond: "
until $(curl --output /dev/null --silent --head --fail http://127.0.0.1:3000); do
  printf '.'
  sleep 5
done
echo "frontend up."

if [[ $CREATE_PROJECT = true ]]; then
    echo -n "Creating default project..."
    LOGIN_TOKEN=`curl --no-progress-meter --header "Content-Type: application/json" --request POST --data '{"email": "admin@example.com", "password": "admin12345"}' http://127.0.0.1:8080/api/login | grep 'token' | cut -d\" -f 4`
    PROJECT_ID=`curl --no-progress-meter --header "Content-Type: application/json" --header "Authorization: Bearer ${LOGIN_TOKEN}" --request POST --data '{"name": "my-project", "title": "My Project"}' http://127.0.0.1:8080/api/project | grep '"id"' | cut -d\" -f 4`
    echo "done."
fi
echo ""
echo "Ibutsu has been deployed into the pod: ${POD_NAME}."
echo "  Frontend URL: http://localhost:3000"
echo "  Backend URL: http://localhost:8080"
if [[ $CREATE_ADMIN = true ]]; then
    echo "  Admin user: admin@example.com / admin12345"
else
    echo "  No admin user created, use -A to create an administrator"
fi
if [[ $CREATE_PROJECT = true ]]; then
    echo "  Project ID: ${PROJECT_ID}"
else
    echo "  No project created, use -P to create a project"
fi
echo "Stop the pod by running: 'podman pod rm -f ${POD_NAME}'"
