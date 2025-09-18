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
OPENAPI_FILE="backend/ibutsu_server/openapi/openapi.yaml"
GENERATOR_VERSION="v7.15.0"
GENERATOR_IMAGE="openapitools/openapi-generator-cli:${GENERATOR_VERSION}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate OpenAPI spec
validate_openapi() {
    local container_cmd="$1"
    echo "Validating OpenAPI specification using ${container_cmd}..."

    if [ ! -f "$OPENAPI_FILE" ]; then
        echo "Error: OpenAPI specification file not found: $OPENAPI_FILE"
        exit 1
    fi

    # Run the validation
    $container_cmd run --rm \
        -v "$(pwd):/local" \
        "$GENERATOR_IMAGE" \
        validate -i "/local/$OPENAPI_FILE"

    if [ $? -eq 0 ]; then
        echo "✅ OpenAPI specification is valid!"
        exit 0
    else
        echo "❌ OpenAPI specification validation failed!"
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
