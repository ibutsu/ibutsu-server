#!/bin/bash

if [[ "$1" == "" ]]; then
    IMAGES_TO_BUILD=("backend", "scheduler", "worker", "flower", "frontend")
else
    IMAGES_TO_BUILD=("$1")
fi

# Image info
IMAGE_TAG=$(git rev-parse --short=7 HEAD)
IMAGE_PREFIX="quay.io/cloudservices/ibutsu-"

# Build images
for IMAGE in "${IMAGES_TO_BUILD[@]}"; do
    echo "---- BUILDING: $IMAGE ----"
    if [[ "$IMAGE" == "frontend" ]]; then
        BASE_DIR=frontend
    else
        BASE_DIR=backend
    fi
    podman build -t "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" -f $BASE_DIR/docker/Dockerfile.$IMAGE ./$BASE_DIR/
done
