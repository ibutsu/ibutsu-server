#!/bin/bash
POD_NAME="ibutsu"
JWT_SECRET=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

echo 'Creating ibutsu pod...'
podman pod create -p 8080:8080 -p 3000:3000 --name $POD_NAME
echo 'Adding postgres to the pod...'
podman run -dt \
       --pod $POD_NAME \
       -e POSTGRES_USER=ibutsu \
       -e POSTGRES_DB=ibutsu \
       -e POSTGRES_PASSWORD=ibutsu \
       --name ibutsu-postgres \
       --rm \
       postgres:latest
echo 'Adding redis to the pod...'
podman run -dt \
       --pod $POD_NAME \
       --name ibutsu-redis \
       --rm \
       redis:latest
echo 'Adding backend to the pod...'
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-backend \
       -e JWT_SECRET=$JWT_SECRET \
       -w /mnt \
       -v./backend:/mnt/:Z \
       python:latest \
       /bin/bash -c 'python -m venv .ibutsu_env && source .ibutsu_env/bin/activate &&
                     pip install -U pip setuptools wheel &&
                     pip install -r requirements.txt &&
                     python -m ibutsu_server'
echo "Waiting for backend to respond"
until $(curl --output /dev/null --silent --head --fail http://localhost:8080); do
  printf '.'
  sleep 5
done
# Note the COLUMNS=80 env var is for https://github.com/celery/celery/issues/5761
printf '\nAdding celery worker to the pod...\n'
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-worker \
       -e COLUMNS=80 \
       -w /mnt \
       -v./backend:/mnt/:Z \
       python:latest \
       /bin/bash -c 'python -m venv .ibutsu_env && source .ibutsu_env/bin/activate &&
                     pip install -U pip setuptools wheel &&
                     pip install -r requirements.txt &&
                     ./celery_worker.sh'
echo 'Adding frontend to the pod...'
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-frontend \
       -w /mnt \
       -v./frontend:/mnt/:Z \
       node:latest \
       /bin/bash -c 'yarn install &&
                     yarn run devserver'
echo "Waiting for frontend to respond"
until $(curl --output /dev/null --silent --head --fail http://localhost:3000); do
  printf '.'
  sleep 5
done
printf "\nIbutsu has been deployed into the pod: ${POD_NAME}.\n"
echo "  Frontend URL: http://localhost:3000"
echo "  Backend URL: http://localhost:8080"
echo "Stop the pod by running: 'podman pod rm -f ${POD_NAME}'"
