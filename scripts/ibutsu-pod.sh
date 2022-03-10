#!/bin/bash
POD_NAME="ibutsu"
JWT_SECRET=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

echo -n "Creating ibutsu pod..."
podman pod create -p 8080:8080 -p 3000:3000 --name $POD_NAME > /dev/null
echo "done."
echo -n "Adding postgres to the pod..."
podman run -dt \
       --pod $POD_NAME \
       -e POSTGRES_USER=ibutsu \
       -e POSTGRES_DB=ibutsu \
       -e POSTGRES_PASSWORD=ibutsu \
       --name ibutsu-postgres \
       --rm \
       postgres:latest > /dev/null
echo "done."
echo -n "Adding redis to the pod..."
podman run -dt \
       --pod $POD_NAME \
       --name ibutsu-redis \
       --rm \
       redis:latest > /dev/null
echo "done."
echo -n "Adding backend to the pod..."
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-backend \
       -e JWT_SECRET=$JWT_SECRET \
       -e POSTGRESQL_HOST=127.0.0.1 \
       -e POSTGRESQL_PORT=5432 \
       -e POSTGRESQL_DATABASE=ibutsu \
       -e POSTGRESQL_USER=ibutsu \
       -e POSTGRESQL_PASSWORD=ibutsu \
       -e CELERY_BROKER_URL='redis://127.0.0.1:6379' \
       -e CELERY_RESULT_BACKEND='redis://127.0.0.1:6379' \
       -w /mnt \
       -v./backend:/mnt/:Z \
       python:3.8.12 \
       /bin/bash -c 'python -m venv .ibutsu_env && source .ibutsu_env/bin/activate &&
                     pip install -U pip setuptools wheel &&
                     pip install -r requirements.txt &&
                     python -m ibutsu_server' > /dev/null
echo "done."
echo -n "Waiting for backend to respond..."
until $(curl --output /dev/null --silent --head --fail http://localhost:8080); do
  echo -n '.'
  sleep 5
done
echo "up."
# Note the COLUMNS=80 env var is for https://github.com/celery/celery/issues/5761
echo -n "Adding celery worker to the pod..."
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-worker \
       -e COLUMNS=80 \
       -e POSTGRESQL_HOST=127.0.0.1 \
       -e POSTGRESQL_PORT=5432 \
       -e POSTGRESQL_DATABASE=ibutsu \
       -e POSTGRESQL_USER=ibutsu \
       -e POSTGRESQL_PASSWORD=ibutsu \
       -e CELERY_BROKER_URL='redis://127.0.0.1:6379' \
       -e CELERY_RESULT_BACKEND='redis://127.0.0.1:6379' \
       -w /mnt \
       -v./backend:/mnt/:Z \
       python:3.8.12 \
       /bin/bash -c 'python -m venv .ibutsu_env && source .ibutsu_env/bin/activate &&
                     pip install -U pip setuptools wheel &&
                     pip install -r requirements.txt &&
                     ./celery_worker.sh' > /dev/null
echo "done."
echo -n "Adding frontend to the pod..."
podman run -dit \
       --rm \
       --pod $POD_NAME \
       --name ibutsu-frontend \
       -w /mnt \
       -v./frontend:/mnt/:Z \
       node:14 \
       /bin/bash -c 'yarn install &&
                     yarn run devserver' > /dev/null
echo "done."
echo -n "Waiting for frontend to respond..."
until $(curl --output /dev/null --silent --head --fail http://localhost:3000); do
  printf '.'
  sleep 5
done
echo "done."
echo -n "Creating admin user..."
podman exec -it ibutsu-postgres psql -U ibutsu ibutsu -c "INSERT INTO users (id, name, email, _password, is_active, is_superadmin) VALUES ('048ad927-300d-47cd-8548-fe58360bfdc3', 'Administrator', 'admin@example.com', '\$2b\$20\$4BYZCFA.mXvrVxbfQtj91uCK4raYZiyCRSaYhq0AlHrAxk6J609Iy', true, true)" > /dev/null
echo "done."
echo -n "Getting JWT token for admin user..."
LOGIN_TOKEN=`curl --no-progress-meter --header "Content-Type: application/json" --request POST --data '{"email": "admin@example.com", "password": "admin12345"}' http://localhost:8080/api/login | grep 'token' | cut -d\" -f 4`
echo "done."
echo -n "Creating default project..."
PROJECT_ID=`curl --no-progress-meter --header "Content-Type: application/json" --header "Authorization: Bearer ${LOGIN_TOKEN}" --request POST --data '{"name": "my-project", "title": "My Project"}' http://localhost:8080/api/project | grep '"id"' | cut -d\" -f 4`
echo "done."
echo ""
echo "Ibutsu has been deployed into the pod: ${POD_NAME}."
echo "  Frontend URL: http://localhost:3000"
echo "  Backend URL: http://localhost:8080"
echo "  Admin user: admin@example.com / admin12345"
echo "  Project ID: ${PROJECT_ID}"
echo "Stop the pod by running: 'podman pod rm -f ${POD_NAME}'"
