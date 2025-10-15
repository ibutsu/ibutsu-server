#!/bin/bash

# OpenAPI Schema Validation Script
# This script validates the OpenAPI specification using the OpenAPI Generator CLI
#
# Dependencies:
# - podman OR docker (for running the OpenAPI Generator container)
# - bash (for script execution)
#
# The script automatically detects which container runtime is available

set -e

# Configuration
OPENAPI_DIR="backend/ibutsu_server/openapi"
OPENAPI_FILE="openapi.yaml"
GENERATOR_VERSION="v7.16.0"
GENERATOR_IMAGE="openapitools/openapi-generator-cli:${GENERATOR_VERSION}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate OpenAPI spec
validate_openapi() {
    local container_cmd="$1"
    echo "Validating OpenAPI specification using ${container_cmd}..."

    if [ ! -f "$OPENAPI_DIR/$OPENAPI_FILE" ]; then
        echo "Error: OpenAPI specification file not found: $OPENAPI_DIR/$OPENAPI_FILE"
        exit 1
    fi

    # Run the validation
    # Mount the openapi directory directly to the container's working directory
    # Use :Z for SELinux systems to allow container access
    if $container_cmd run --rm \
        -v "$(pwd)/$OPENAPI_DIR:/local:Z" \
        "$GENERATOR_IMAGE" \
        validate -i "/local/$OPENAPI_FILE"; then
        echo "OpenAPI specification is valid!"
        exit 0
    else
        echo "OpenAPI specification validation failed!"
        exit 1
    fi
}

# Check for available container runtime
if command_exists podman; then
    validate_openapi "podman"
elif command_exists docker; then
    validate_openapi "docker"
else
    echo "Error: Neither podman nor docker is available."
    echo "Please install either podman or docker to run OpenAPI validation."
    exit 1
fi
