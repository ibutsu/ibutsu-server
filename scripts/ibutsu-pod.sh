#!/bin/bash

# Some variables
POD_NAME="ibutsu"
JWT_SECRET=$(LC_CTYPE=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32)
DATA_PERSISTENT=false
DATA_VOLUMES=false
CREATE_ADMIN=false
CREATE_PROJECT=false
IMPORT_FOLDER="./.archives"
IMPORT_FILES=true
POSTGRES_EXTRA_ARGS=
REDIS_EXTRA_ARGS=
BACKEND_EXTRA_ARGS=
PYTHON_IMAGE=registry.access.redhat.com/ubi9/python-39:latest

ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin12345"

function print_usage() {
    echo "Usage: ibutsu-pod.sh [-h|--help] [-d|--data-persistent] [-v|--data-volumes] [-a|--create-admin] [-p|--create-project] [-s|--skip-import] [-f|--import-folder FOLDER] [POD_NAME]"
    echo ""
    echo "optional arguments:"
    echo "  -h, --help                 show this help message"
    echo "  -d, --data-persistent      persist the data in the containers (use this for keeping data between pod restarts)"
    echo "  -v, --data-volumes         use podman volumes to store data"
    echo "  -a, --create-admin         create an administrator (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})"
    echo "  -p, --create-project       create a default project ('my-project')"
    echo "  -s, --skip-import          skip importing files from the import folder"
    echo "  -f, --import-folder        folder containing files to import (./.archives/ by default)"
    echo "  POD_NAME                   the name of the pod, 'ibutsu' if ommitted"
    echo ""
}

# Parse the arguments
i=1
while [[ $i -le $# ]]; do
    case "${!i}" in
        -d|--data-persistent)
            DATA_PERSISTENT=true
            ;;
        -v|--data-volumes)
            DATA_VOLUMES=true
            ;;
        -a|--create-admin)
            CREATE_ADMIN=true
            ;;
        -p|--create-project)
            CREATE_PROJECT=true
            ;;
        -s|--skip-import)
            IMPORT_FILES=false
            ;;
        -f|--import-folder)
            ((i++))
            if [[ $i -le $# ]]; then
                IMPORT_FOLDER="${!i}"
            else
                echo "Error: Missing argument for --import-folder"
                print_usage
                exit 1
            fi
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        -*)
            echo "Unknown option: ${!i}"
            print_usage
            exit 1
            ;;
        *)
            POD_NAME="${!i}"
            ;;
    esac
    ((i++))
done

for TOOL in jq curl podman tr fold head cut; do
    if ! command -v $TOOL &> /dev/null; then
        echo "Error: $TOOL is required but not installed."
        exit 1
    fi
done

# Check this is being run in the correct directory
DIRS=$(ls -p | grep '/')
if [[ ! ${DIRS[*]} =~ "backend" ]] && [[ ! ${DIRS[*]} =~ "frontend" ]]; then
    echo "This script needs to be run from the root of the project"
    exit 1
fi

# If the data is persistent, check if there's a JWT secret in a file, or save it
if [[ $DATA_PERSISTENT = true ]]; then
    if [[ ! -f ".jwtsecret" ]]; then
        echo $JWT_SECRET > .jwtsecret
    else
        JWT_SECRET=$(<.jwtsecret)
    fi
fi

# Persist the data
if [[ $DATA_PERSISTENT = true ]]; then
    POSTGRES_EXTRA_ARGS+=' -e PGDATA=/var/lib/postgres/data/pgdata'
    if [[ $DATA_VOLUMES = true ]]; then
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
    BACKEND_EXTRA_ARGS+=" -e IBUTSU_SUPERADMIN_EMAIL=${ADMIN_EMAIL} -e IBUTSU_SUPERADMIN_PASSWORD=${ADMIN_PASSWORD} -e IBUTSU_SUPERADMIN_NAME=Administrator"
fi

# Print out a quick summary of actions
echo "Summary of actions:"
if [[ $DATA_PERSISTENT = true ]]; then
    if [[ $DATA_VOLUMES = true ]]; then
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
if [[ $IMPORT_FILES = true ]]; then
    echo "  Files will be imported from ${IMPORT_FOLDER}"
fi
echo "Stop the pod by running: 'podman pod rm -f ${POD_NAME}'"
echo ""

# Get the pods up and running
echo -n "Creating ibutsu pod:    "
podman pod create -p 8080:8080 -p 3000:3000 --name $POD_NAME

echo "================================="
echo -n "Adding postgres to the pod:    "
podman run -dt \
    --rm \
    --pod $POD_NAME \
    -e POSTGRESQL_USER=ibutsu \
    -e POSTGRESQL_DATABASE=ibutsu \
    -e POSTGRESQL_PASSWORD=ibutsu \
    $POSTGRES_EXTRA_ARGS \
    --name ibutsu-postgres \
    registry.redhat.io/rhel8/postgresql-12

echo "================================="
echo -n "Adding redis to the pod:    "
podman run -dt \
    --rm \
    --pod $POD_NAME \
    $REDIS_EXTRA_ARGS \
    --name ibutsu-redis \
    quay.io/fedora/redis-7

echo "================================="
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
    -v ./backend:/mnt/:z \
    $PYTHON_IMAGE \
    /bin/bash -c 'python -m pip install -U pip wheel setuptools &&
                    pip install . &&
                    python -m ibutsu_server --host 0.0.0.0'
echo -n "Waiting for backend to respond: "
sleep 5
until $(curl --output /dev/null --silent --head --fail http://127.0.0.1:8080); do
  echo -n ' .'
  sleep 2
done
echo " backend up."


# Note the COLUMNS=80 env var is for https://github.com/celery/celery/issues/5761
echo "================================="
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
    -v ./backend:/mnt/:z \
    $PYTHON_IMAGE \
    /bin/bash -c 'pip install -U pip wheel &&
                    pip install . &&
                    ./celery_worker.sh'
echo -n "Waiting for celery to respond: "
sleep 5
until $(podman exec ibutsu-worker celery inspect ping -d celery@ibutsu 2>/dev/null | grep -q pong); do
    echo -n ' .'
    sleep 2
done
echo " celery worker up."


if [[ $CREATE_PROJECT = true ]]; then
    echo -n "Creating default project... "
    LOGIN_TOKEN=$(curl --no-progress-meter --header "Content-Type: application/json" \
        --request POST \
        --data "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}" \
        http://127.0.0.1:8080/api/login | jq -r '.token')

    PROJECT_ID=$(curl --no-progress-meter --header "Content-Type: application/json" \
    --header "Authorization: Bearer ${LOGIN_TOKEN}" \
    --request POST \
    --data '{"name": "my-project", "title": "My Project"}' \
    http://127.0.0.1:8080/api/project | jq -r '.id')

    echo "Project created"


    # Import files if requested and project was created
    if [[ $IMPORT_FILES = true ]] &&
        [[ -n "$PROJECT_ID" ]] &&
        [[ -n "$LOGIN_TOKEN" ]]; then
        echo "Importing files from: ${IMPORT_FOLDER}"

        # Initialize counters for successful and failed imports
        SUCCESSFUL_IMPORTS=0
        FAILED_IMPORTS=0

        # Check if the import folder exists
        if [[ ! -d "$IMPORT_FOLDER" ]]; then
            echo "Import folder not found: ${IMPORT_FOLDER}"
        else
            # Get list of files in the import folder
            FILES=$(ls -1 ${IMPORT_FOLDER}/*.tar.gz 2>/dev/null || true)
            if [[ -z "${FILES}" ]]; then
                echo "No files found in the import folder: ${IMPORT_FOLDER}"

            else
                for FILE in ${FILES}; do
                    echo -n "Importing ${FILE}... "

                    # Submit the file for import
                    IMPORT_RESPONSE=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
                        --request POST \
                        --form "importFile=@${FILE}" \
                        --form "project=${PROJECT_ID}" \
                        http://127.0.0.1:8080/api/import)
                    # Extract the import ID from the response
                    if [[ $? -ne 0 ]]; then
                        echo "Failed to submit import for ${FILE}."
                        echo "import response: ${IMPORT_RESPONSE}"

                        ((FAILED_IMPORTS++))
                        continue
                    fi

                    IMPORT_ID=$(echo ${IMPORT_RESPONSE} | jq -r '.id')
                    IMPORT_STATUS=$(echo ${IMPORT_RESPONSE} | jq -r '.status')

                    if [[ -z "$IMPORT_ID" ]]; then
                        echo "Failed to get import ID."
                        ((FAILED_IMPORTS++))
                        continue
                    else
                        # Wait for import to complete with a retry limit
                        RETRY_COUNT=0
                        MAX_RETRIES=10
                        while [[ ("${IMPORT_STATUS}" == pending || "${IMPORT_STATUS}" == running) && ${RETRY_COUNT} -lt ${MAX_RETRIES} ]]; do
                            IMPORT_STATUS=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
                                http://127.0.0.1:8080/api/import/${IMPORT_ID} | jq -r '.status')

                            # Increment retry counter
                            ((RETRY_COUNT++))

                            # Wait before checking again
                            sleep 1
                            echo -n " ."
                        done
                    fi

                    # Check if we hit the retry limit
                    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
                        echo "timed out after ${MAX_RETRIES} attempts."
                        ((FAILED_IMPORTS++))
                    fi

                    if [[ "$IMPORT_STATUS" == "done" ]]; then
                        echo " completed."
                        ((SUCCESSFUL_IMPORTS++))
                    fi
                done
            fi
        fi
        RUNS_COUNT=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            http://127.0.0.1:8080/api/run | jq -r '.runs | length')
        echo "Runs in the database: ${RUNS_COUNT}"
    fi

    # Create default widget configurations for the project
    echo "Creating Jenkins views... "

    # Create first widget config - Jenkins Jobs View
    JENKINS_JOBS_VIEW=$(curl --no-progress-meter --header "Content-Type: application/json" \
        --header "Authorization: Bearer ${LOGIN_TOKEN}" \
        --request POST \
        --data "{\"params\": {}, \"project_id\": \"${PROJECT_ID}\", \"title\": \"Jenkins Jobs\", \"type\": \"view\", \"widget\": \"jenkins-job-view\"}" \
        http://127.0.0.1:8080/api/widget-config | jq -r '.id')

    echo "  Jenkins Jobs ID: ${JENKINS_JOBS_VIEW}"

    # Create second widget config - Jenkins analysis View
    JENKINS_ANALYSIS_VIEW=$(curl --no-progress-meter --header "Content-Type: application/json" \
        --header "Authorization: Bearer ${LOGIN_TOKEN}" \
        --request POST \
        --data "{\"params\": {}, \"project_id\": \"${PROJECT_ID}\", \"title\": \"Jenkins Analysis\", \"type\": \"view\", \"widget\": \"jenkins-analysis-view\"}" \
        http://127.0.0.1:8080/api/widget-config | jq -r '.id')

    echo "  Jenkins Analysis ID: ${JENKINS_ANALYSIS_VIEW}"

    # create a dashboard
    echo "Creating default dashboard... "
    DASHBOARD_ID=$(curl --no-progress-meter --header "Content-Type: application/json" \
        --header "Authorization: Bearer ${LOGIN_TOKEN}" \
        --request POST \
        --data "{\"description\": \"Auto Dashboard\", \"title\": \"Auto Dashboard\", \"project_id\": \"${PROJECT_ID}\"}" \
        http://127.0.0.1:8080/api/dashboard | jq -r '.id')

    if [[ -z "$DASHBOARD_ID" ]]; then
        echo "Failed to create dashboard."
    else
        echo "Dashboard created with ID: ${DASHBOARD_ID}"

        # set dashboard as default for the project
        PROJECT_PUT=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request PUT \
            --data "{\"default_dashboard_id\": \"${DASHBOARD_ID}\"}" \
            http://127.0.0.1:8080/api/project/${PROJECT_ID} | jq -r '.default_dashboard_id')
        if [[ "$PROJECT_PUT" != "$DASHBOARD_ID" ]]; then
            echo "Failed to set dashboard as default for the project."
        else
            echo "Dashboard set as default for the project."
        fi

        # Add widgets to the dashboard
        echo "Adding widgets to the dashboard..."
        RUN_COMPONENT=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            http://127.0.0.1:8080/api/run | jq -r '.runs[0].component' | sort -u |tr -d '[:space:]')

        echo "Found unique components: ${RUN_COMPONENT}"

        FILTERED_HEATMAP=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "{\"dashboard_id\": \"${DASHBOARD_ID}\", \
                    \"project_id\": \"${PROJECT_ID}\", \
                    \"title\": \"FilteredHeatmap\", \
                    \"type\": \"widget\", \
                    \"widget\": \"filter-heatmap\", \
                    \"params\": {\"filters\": \"component=${RUN_COMPONENT}\", \
                               \"group_field\": \"component\", \
                               \"builds\": 10}}" \
            http://127.0.0.1:8080/api/widget-config | jq -r '.id')
        echo "  Filtered Heatmap ID: ${FILTERED_HEATMAP}"

        RUN_AGGREGATOR=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "{\"dashboard_id\": \"${DASHBOARD_ID}\", \
                    \"project_id\": \"${PROJECT_ID}\", \
                    \"title\": \"Run Aggregation\", \
                    \"type\": \"widget\", \
                    \"widget\": \"run-aggregator\", \
                    \"params\": {\"group_field\": \"component\", \
                               \"weeks\": 12}}" \
            http://127.0.0.1:8080/api/widget-config | jq -r '.id')
        echo "  Run Aggregator ID: ${RUN_AGGREGATOR}"

        RESULT_SUMMARY=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "{\"dashboard_id\": \"${DASHBOARD_ID}\", \
                    \"project_id\": \"${PROJECT_ID}\", \
                    \"title\": \"Result Summary\", \
                    \"type\": \"widget\", \
                    \"widget\": \"result-summary\", \
                    \"params\": {}}" \
            http://127.0.0.1:8080/api/widget-config | jq -r '.id')
        echo "  Result Summary ID: ${RESULT_SUMMARY}"

        RESULT_AGGREGATOR=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "{\"dashboard_id\": \"${DASHBOARD_ID}\", \
                    \"project_id\": \"${PROJECT_ID}\", \
                    \"title\": \"Result Aggregation\", \
                    \"type\": \"widget\", \
                    \"widget\": \"result-aggregator\", \
                    \"params\": {\"group_field\": \"result\", \
                                \"chart_type\": \"donut\", \
                                \"days\": 30, \
                                \"additional_filters\": \"env*stage_proxy;stage\", \}}" \
            http://127.0.0.1:8080/api/widget-config | jq -r '.id')
        echo "  Result Aggregator ID: ${RESULT_AGGREGATOR}"

    fi

fi

echo "================================="
echo -n "Adding frontend to the pod:    "
podman run -d \
    --rm \
    --pod $POD_NAME \
    --name ibutsu-frontend \
    -w /mnt \
    -v ./frontend:/mnt/:Z \
    node:$(cut -d 'v' -f 2 < './frontend/.nvmrc') \
    /bin/bash -c "node --dns-result-order=ipv4first /usr/local/bin/npm install --no-save --no-package-lock yarn &&
        yarn install &&
        CI=1 yarn devserver"
echo "done."

echo -n "Waiting for frontend to respond: "
until $(curl --output /dev/null --silent --head --fail http://127.0.0.1:3000); do
  printf ' .'
  sleep 5
done
echo " frontend available."

echo "Ibutsu has been deployed into the pod: ${POD_NAME}."
echo "  Frontend URL: http://localhost:3000"
echo "  Backend URL: http://localhost:8080"

if [[ $CREATE_ADMIN = true ]]; then
    echo "  Admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
fi

# If the project was created, print the project ID and import results
if [[ $CREATE_PROJECT = true ]]; then
    echo "  Project ID: ${PROJECT_ID}"
    echo "  JWT Bearer Token: ${LOGIN_TOKEN}"

    if [[ $IMPORT_FILES = true ]]; then
        if [[ -n "$SUCCESSFUL_IMPORTS" ]] && [[ "$SUCCESSFUL_IMPORTS" -gt 0 ]]; then
            echo "  Successfully imported: ${SUCCESSFUL_IMPORTS} files"
        fi
        if [[ -n "$FAILED_IMPORTS" ]] && [[ "$FAILED_IMPORTS" -gt 0 ]]; then
            echo "  Failed to import: ${FAILED_IMPORTS} files"
        fi
    fi
fi

echo "Stop the pod by running: \"podman pod rm -f ${POD_NAME}\""
