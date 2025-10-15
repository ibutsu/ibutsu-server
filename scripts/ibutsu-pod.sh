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
    echo "  POD_NAME                   the name of the pod, 'ibutsu' if omitted"
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
    if ! command -v "$TOOL" &> /dev/null; then
        echo "Error: $TOOL is required but not installed."
        exit 1
    fi
done

# Check this is being run in the correct directory
# Check this is being run in the correct directory
if [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    echo "This script needs to be run from the root of the project"
    exit 1
fi

# If the data is persistent, check if there's a JWT secret in a file, or save it
if [[ $DATA_PERSISTENT = true ]]; then
    if [[ ! -f ".jwtsecret" ]]; then
        echo "$JWT_SECRET" > .jwtsecret
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
podman pod create -p 8080:8080 -p 3000:3000 --name "$POD_NAME"

echo "================================="
echo -n "Adding postgres to the pod:    "
podman run -dt \
    --rm \
    --pod "$POD_NAME" \
    -e POSTGRESQL_USER=ibutsu \
    -e POSTGRESQL_DATABASE=ibutsu \
    -e POSTGRESQL_PASSWORD=ibutsu \
    "$POSTGRES_EXTRA_ARGS" \
    --name ibutsu-postgres \
    registry.redhat.io/rhel8/postgresql-12

echo "================================="
echo -n "Adding redis to the pod:    "
podman run -dt \
    --rm \
    --pod "$POD_NAME" \
    "$REDIS_EXTRA_ARGS" \
    --name ibutsu-redis \
    quay.io/fedora/redis-7

echo "================================="
echo -n "Adding backend to the pod:    "
# https://docs.sqlalchemy.org/en/20/changelog/migration_20.html#migration-to-2-0-step-two-turn-on-removedin20warnings
podman run -d \
    --rm \
    --pod "$POD_NAME" \
    --name ibutsu-backend \
    -e JWT_SECRET="$JWT_SECRET" \
    -e POSTGRESQL_HOST=127.0.0.1 \
    -e POSTGRESQL_PORT=5432 \
    -e POSTGRESQL_DATABASE=ibutsu \
    -e POSTGRESQL_USER=ibutsu \
    -e POSTGRESQL_PASSWORD=ibutsu \
    -e CELERY_BROKER_URL=redis://127.0.0.1:6379 \
    -e CELERY_RESULT_BACKEND=redis://127.0.0.1:6379 \
    -e SQLALCHEMY_WARN_20=1 \
    "$BACKEND_EXTRA_ARGS" \
    -w /mnt \
    -v ./backend:/mnt/:z \
    $PYTHON_IMAGE \
    /bin/bash -c 'python -m pip install -U pip wheel setuptools &&
                    pip install . &&
                    python -W always::DeprecationWarning -m ibutsu_server --host 0.0.0.0'
echo -n "Waiting for backend to respond: "
sleep 5
until curl --output /dev/null --silent --head --fail http://127.0.0.1:8080; do
  echo -n ' .'
  sleep 2
done
echo " backend up."


# Note the COLUMNS=80 env var is for https://github.com/celery/celery/issues/5761
echo "================================="
echo -n "Adding celery worker to the pod:    "
podman run -d \
    --rm \
    --pod "$POD_NAME" \
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
until podman exec ibutsu-worker celery inspect ping -d celery@ibutsu 2>/dev/null | grep -q pong; do
    echo -n ' .'
    sleep 2
done
echo " celery worker up."


if [[ $CREATE_PROJECT = true ]]; then
    echo "Creating default projects... "
    LOGIN_TOKEN=$(curl --no-progress-meter --header "Content-Type: application/json" \
        --request POST \
        --data "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}" \
        http://127.0.0.1:8080/api/login | jq -r '.token')

    # Create first project
    echo -n "  Creating my-project-1... "
    PROJECT_ID_1=$(curl --no-progress-meter --header "Content-Type: application/json" \
    --header "Authorization: Bearer ${LOGIN_TOKEN}" \
    --request POST \
    --data '{"name": "my-project-1", "title": "My Project 1"}' \
    http://127.0.0.1:8080/api/project | jq -r '.id')
    echo "done (ID: ${PROJECT_ID_1})"

    # Create second project
    echo -n "  Creating my-project-2... "
    PROJECT_ID_2=$(curl --no-progress-meter --header "Content-Type: application/json" \
    --header "Authorization: Bearer ${LOGIN_TOKEN}" \
    --request POST \
    --data '{"name": "my-project-2", "title": "My Project 2"}' \
    http://127.0.0.1:8080/api/project | jq -r '.id')
    echo "done (ID: ${PROJECT_ID_2})"

    echo "Projects created"


    # Import files if requested and projects were created
    if [[ $IMPORT_FILES = true ]] &&
        [[ -n "$PROJECT_ID_1" ]] &&
        [[ -n "$PROJECT_ID_2" ]] &&
        [[ -n "$LOGIN_TOKEN" ]]; then
        echo "Importing files from: ${IMPORT_FOLDER}"

        # Initialize counters for successful and failed imports
        SUCCESSFUL_IMPORTS_1=0
        FAILED_IMPORTS_1=0
        SUCCESSFUL_IMPORTS_2=0
        FAILED_IMPORTS_2=0

        # Track first imported file per project for component extraction
        FIRST_IMPORT_ID_1=""
        FIRST_IMPORT_ID_2=""

        # Check if the import folder exists
        if [[ ! -d "$IMPORT_FOLDER" ]]; then
            echo "Import folder not found: ${IMPORT_FOLDER}"
        else
            # Get list of files in the import folder, sorted by modification time
            # Using find with null-terminated strings for safe handling of paths with spaces
            FILES_ARRAY=()
            while IFS= read -r -d '' file; do
                FILES_ARRAY+=("$file")
            done < <(find "$IMPORT_FOLDER" -maxdepth 1 -name "*.tar.gz" -type f -printf '%T@\t%p\0' 2>/dev/null | sort -zrn | cut -z -f2-)

            FILE_COUNT=${#FILES_ARRAY[@]}

            if [[ $FILE_COUNT -eq 0 ]]; then
                echo "No files found in the import folder: ${IMPORT_FOLDER}"
            else
                echo "Found ${FILE_COUNT} files to import"

                # Alternate between projects based on sorted date
                for i in "${!FILES_ARRAY[@]}"; do
                    FILE="${FILES_ARRAY[$i]}"

                    # Alternate between projects (even indices go to project 1, odd to project 2)
                    if (( i % 2 == 0 )); then
                        CURRENT_PROJECT_ID="$PROJECT_ID_1"
                        PROJECT_NAME="my-project-1"
                    else
                        CURRENT_PROJECT_ID="$PROJECT_ID_2"
                        PROJECT_NAME="my-project-2"
                    fi

                    echo -n "Importing ${FILE} to ${PROJECT_NAME}... "

                    # Submit the file for import
                    if ! IMPORT_RESPONSE=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
                        --request POST \
                        --form "importFile=@${FILE}" \
                        --form "project=${CURRENT_PROJECT_ID}" \
                        http://127.0.0.1:8080/api/import); then
                        echo "Failed to submit import for ${FILE}."
                        echo "import response: ${IMPORT_RESPONSE}"

                        if (( i % 2 == 0 )); then
                            ((FAILED_IMPORTS_1++))
                        else
                            ((FAILED_IMPORTS_2++))
                        fi
                        continue
                    fi

                    IMPORT_ID=$(echo "${IMPORT_RESPONSE}" | jq -r '.id')
                    IMPORT_STATUS=$(echo "${IMPORT_RESPONSE}" | jq -r '.status')

                    if [[ -z "$IMPORT_ID" ]]; then
                        echo "Failed to get import ID."
                        if (( i % 2 == 0 )); then
                            ((FAILED_IMPORTS_1++))
                        else
                            ((FAILED_IMPORTS_2++))
                        fi
                        continue
                    else
                        # Wait for import to complete with a retry limit
                        RETRY_COUNT=0
                        MAX_RETRIES=10
                        while [[ ("${IMPORT_STATUS}" == pending || "${IMPORT_STATUS}" == running) && ${RETRY_COUNT} -lt ${MAX_RETRIES} ]]; do
                            IMPORT_STATUS=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
                                http://127.0.0.1:8080/api/import/"${IMPORT_ID}" | jq -r '.status')

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
                        if (( i % 2 == 0 )); then
                            ((FAILED_IMPORTS_1++))
                        else
                            ((FAILED_IMPORTS_2++))
                        fi
                    fi

                    if [[ "$IMPORT_STATUS" == "done" ]]; then
                        echo " completed."
                        if (( i % 2 == 0 )); then
                            ((SUCCESSFUL_IMPORTS_1++))
                            # Track first successful import for project 1
                            if [[ -z "$FIRST_IMPORT_ID_1" ]]; then
                                FIRST_IMPORT_ID_1="$IMPORT_ID"
                            fi
                        else
                            ((SUCCESSFUL_IMPORTS_2++))
                            # Track first successful import for project 2
                            if [[ -z "$FIRST_IMPORT_ID_2" ]]; then
                                FIRST_IMPORT_ID_2="$IMPORT_ID"
                            fi
                        fi
                    fi
                done
            fi
        fi
        RUNS_COUNT=$(curl --no-progress-meter --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            http://127.0.0.1:8080/api/run | jq -r '.runs | length')
        echo "Total runs in the database: ${RUNS_COUNT}"
        echo ""
        echo "Import Summary:"
        echo "  my-project-1: ${SUCCESSFUL_IMPORTS_1} successful, ${FAILED_IMPORTS_1} failed"
        echo "  my-project-2: ${SUCCESSFUL_IMPORTS_2} successful, ${FAILED_IMPORTS_2} failed"
        echo "  Total: $((SUCCESSFUL_IMPORTS_1 + SUCCESSFUL_IMPORTS_2)) successful, $((FAILED_IMPORTS_1 + FAILED_IMPORTS_2)) failed"
    fi

    # Helper function to make API POST requests with JSON
    api_post() {
        local endpoint=$1
        local data=$2
        local response
        response=$(curl --no-progress-meter --fail-with-body \
            --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "$data" \
            "http://127.0.0.1:8080${endpoint}" 2>&1)
        local exit_code=$?
        if [[ $exit_code -ne 0 ]]; then
            echo "API POST error (${endpoint}): ${response}" >&2
        fi
        echo "$response"
        return $exit_code
    }

    # Helper function to make API PUT requests with JSON
    api_put() {
        local endpoint=$1
        local data=$2
        local response
        response=$(curl --no-progress-meter --fail-with-body \
            --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request PUT \
            --data "$data" \
            "http://127.0.0.1:8080${endpoint}" 2>&1)
        local exit_code=$?
        if [[ $exit_code -ne 0 ]]; then
            echo "API PUT error (${endpoint}): ${response}" >&2
        fi
        echo "$response"
        return $exit_code
    }

    # Helper function to make API GET requests
    api_get() {
        local endpoint=$1
        local response
        response=$(curl --no-progress-meter --fail-with-body \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            "http://127.0.0.1:8080${endpoint}" 2>&1)
        local exit_code=$?
        if [[ $exit_code -ne 0 ]]; then
            echo "API GET error (${endpoint}): ${response}" >&2
        fi
        echo "$response"
        return $exit_code
    }

    # Helper function to create a widget config
    create_widget_config() {
        local dashboard_id=$1
        local project_id=$2
        local title=$3
        local widget_type=$4
        local params=$5
        local config_type=${6:-widget}

        # Build JSON payload, handling empty dashboard_id
        local json_payload
        if [[ -z "$dashboard_id" ]]; then
            json_payload="{\"project_id\": \"${project_id}\", \
              \"title\": \"${title}\", \
              \"type\": \"${config_type}\", \
              \"widget\": \"${widget_type}\", \
              \"params\": ${params}}"
        else
            json_payload="{\"dashboard_id\": \"${dashboard_id}\", \
              \"project_id\": \"${project_id}\", \
              \"title\": \"${title}\", \
              \"type\": \"${config_type}\", \
              \"widget\": \"${widget_type}\", \
              \"params\": ${params}}"
        fi

        api_post "/api/widget-config" "$json_payload" | jq -r '.id'
    }

    # Function to extract component from first imported run for a project
    get_component_from_import() {
        local import_id=$1
        local project_id=$2

        # Get the import details to find the run
        local import_data
        import_data=$(api_get "/api/import/${import_id}")
        local run_id
        run_id=$(echo "$import_data" | jq -r '.data.run_id // empty')

        if [[ -n "$run_id" ]]; then
            # Get the run details
            local run_data
            run_data=$(api_get "/api/run/${run_id}")
            local component
            component=$(echo "$run_data" | jq -r '.component // empty')
            if [[ -n "$component" && "$component" != "null" ]]; then
                echo "$component"
                return 0
            fi
        fi

        # Fallback: try to get component from first run in project
        local runs_data
        runs_data=$(api_get "/api/run?project=${project_id}&page_size=1")
        local component
        component=$(echo "$runs_data" | jq -r '.runs[0].component // empty' 2>/dev/null)

        if [[ -n "$component" && "$component" != "null" ]]; then
            echo "$component"
        else
            echo ""
        fi
    }

    # Function to create widget configurations for a project
    create_widgets_for_project() {
        local PROJECT_ID=$1
        local PROJECT_NAME=$2
        local FIRST_IMPORT_ID=$3

        echo "Creating widgets for ${PROJECT_NAME}..."

        # Create first widget config - Jenkins Jobs View
        JENKINS_JOBS_VIEW=$(create_widget_config "" "$PROJECT_ID" "Jenkins Jobs" "jenkins-job-view" "{}" "view")
        if [[ -n "$JENKINS_JOBS_VIEW" && "$JENKINS_JOBS_VIEW" != "null" ]]; then
            echo "  Jenkins Jobs ID: ${JENKINS_JOBS_VIEW}"
        else
            echo "  Warning: Failed to create Jenkins Jobs view"
        fi

        # Create second widget config - Jenkins analysis View
        JENKINS_ANALYSIS_VIEW=$(create_widget_config "" "$PROJECT_ID" "Jenkins Analysis" "jenkins-analysis-view" "{}" "view")
        if [[ -n "$JENKINS_ANALYSIS_VIEW" && "$JENKINS_ANALYSIS_VIEW" != "null" ]]; then
            echo "  Jenkins Analysis ID: ${JENKINS_ANALYSIS_VIEW}"
        else
            echo "  Warning: Failed to create Jenkins Analysis view"
        fi

        # create a dashboard
        echo "  Creating dashboard for ${PROJECT_NAME}... "
        DASHBOARD_ID=$(api_post "/api/dashboard" \
            "{\"description\": \"Auto Dashboard\", \"title\": \"Auto Dashboard\", \"project_id\": \"${PROJECT_ID}\"}" | jq -r '.id')

        if [[ -z "$DASHBOARD_ID" ]]; then
            echo "  Failed to create dashboard for ${PROJECT_NAME}."
        else
            echo "  Dashboard created with ID: ${DASHBOARD_ID}"

            # set dashboard as default for the project
            PROJECT_PUT=$(api_put "/api/project/${PROJECT_ID}" \
                "{\"default_dashboard_id\": \"${DASHBOARD_ID}\"}" | jq -r '.default_dashboard_id')
            if [[ "$PROJECT_PUT" != "$DASHBOARD_ID" ]]; then
                echo "  Failed to set dashboard as default for ${PROJECT_NAME}."
            else
                echo "  Dashboard set as default for ${PROJECT_NAME}."
            fi

            # Add widgets to the dashboard
            echo "  Adding widgets to the dashboard..."

            # Get component from first imported file for this project
            RUN_COMPONENT=""
            if [[ -n "$FIRST_IMPORT_ID" ]]; then
                RUN_COMPONENT=$(get_component_from_import "$FIRST_IMPORT_ID" "$PROJECT_ID")
            fi

            if [[ -z "$RUN_COMPONENT" ]]; then
                echo "  Warning: No component found for ${PROJECT_NAME}, widgets may not display data correctly"
                RUN_COMPONENT="unknown"
            else
                echo "  Using component from first import: ${RUN_COMPONENT}"
            fi

            FILTERED_HEATMAP=$(create_widget_config "$DASHBOARD_ID" "$PROJECT_ID" "FilteredHeatmap" "filter-heatmap" \
                "{\"filters\": \"component=${RUN_COMPONENT}\", \"group_field\": \"component\", \"builds\": 10}")
            echo "    Filtered Heatmap ID: ${FILTERED_HEATMAP}"

            RUN_AGGREGATOR=$(create_widget_config "$DASHBOARD_ID" "$PROJECT_ID" "Run Aggregation" "run-aggregator" \
                "{\"group_field\": \"env\", \"weeks\": 52}")
            echo "    Run Aggregator ID: ${RUN_AGGREGATOR}"

            RESULT_SUMMARY=$(create_widget_config "$DASHBOARD_ID" "$PROJECT_ID" "Result Summary" "result-summary" "{}")
            echo "    Result Summary ID: ${RESULT_SUMMARY}"

            RESULT_AGGREGATOR=$(create_widget_config "$DASHBOARD_ID" "$PROJECT_ID" "Result Aggregation" "result-aggregator" \
                "{\"group_field\": \"metadata.assignee\", \"days\": 360, \"additional_filters\": \"env*stage_proxy;stage\"}")
            echo "    Result Aggregator ID: ${RESULT_AGGREGATOR}"
        fi
    }

    # Create widgets for both projects
    create_widgets_for_project "${PROJECT_ID_1}" "my-project-1" "${FIRST_IMPORT_ID_1}"
    create_widgets_for_project "${PROJECT_ID_2}" "my-project-2" "${FIRST_IMPORT_ID_2}"

    # Create additional users and assign them to both projects
    echo "Creating 5 additional admin users..."
    for i in {1..5}
    do
        # Create the user
        USER_ID=$(curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request POST \
            --data "{\"email\": \"extrauser${i}@example.com\", \"password\": \"admin12345\", \"is_active\": true, \"is_superadmin\": true, \"name\": \"Extra User ${i}\"}" \
            http://127.0.0.1:8080/api/admin/user | jq -r '.id')

        # Add user to both projects by updating the user
        curl --no-progress-meter --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${LOGIN_TOKEN}" \
            --request PUT \
            --data "{\"projects\": [{\"id\": \"${PROJECT_ID_1}\"}, {\"id\": \"${PROJECT_ID_2}\"}]}" \
            http://127.0.0.1:8080/api/admin/user/"${USER_ID}" > /dev/null

        echo "  Created user extrauser${i}@example.com with password admin12345 and added to both projects"
    done

fi

echo "================================="
echo -n "Adding frontend to the pod:    "
podman run -d \
    --rm \
    --pod "$POD_NAME" \
    --name ibutsu-frontend \
    -w /mnt \
    -v ./frontend:/mnt/:Z \
    "node:$(cut -d 'v' -f 2 < './frontend/.nvmrc')" \
    /bin/bash -c "node --dns-result-order=ipv4first /usr/local/bin/npm install --no-save --no-package-lock yarn &&
        yarn install &&
        CI=1 yarn devserver"
echo "done."

echo -n "Waiting for frontend to respond: "
until curl --output /dev/null --silent --head --fail http://127.0.0.1:3000; do
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

# If the projects were created, print the project IDs and import results
if [[ $CREATE_PROJECT = true ]]; then
    echo "  Project 1 ID: ${PROJECT_ID_1}"
    echo "  Project 2 ID: ${PROJECT_ID_2}"
    echo "  JWT Bearer Token: ${LOGIN_TOKEN}"

    if [[ $IMPORT_FILES = true ]]; then
        echo ""
        echo "  Import results for my-project-1:"
        if [[ -n "$SUCCESSFUL_IMPORTS_1" ]] && [[ "$SUCCESSFUL_IMPORTS_1" -gt 0 ]]; then
            echo "    Successfully imported: ${SUCCESSFUL_IMPORTS_1} files"
        fi
        if [[ -n "$FAILED_IMPORTS_1" ]] && [[ "$FAILED_IMPORTS_1" -gt 0 ]]; then
            echo "    Failed to import: ${FAILED_IMPORTS_1} files"
        fi

        echo ""
        echo "  Import results for my-project-2:"
        if [[ -n "$SUCCESSFUL_IMPORTS_2" ]] && [[ "$SUCCESSFUL_IMPORTS_2" -gt 0 ]]; then
            echo "    Successfully imported: ${SUCCESSFUL_IMPORTS_2} files"
        fi
        if [[ -n "$FAILED_IMPORTS_2" ]] && [[ "$FAILED_IMPORTS_2" -gt 0 ]]; then
            echo "    Failed to import: ${FAILED_IMPORTS_2} files"
        fi
    fi
fi

echo "Stop the pod by running: \"podman pod rm -f ${POD_NAME}\""
