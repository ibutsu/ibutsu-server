#!/bin/bash

set -exv

if [[ -z "$QUAY_USER" || -z "$QUAY_TOKEN" ]]; then
    echo "QUAY_USER and QUAY_TOKEN must be set"
    exit 1
fi

if [[ -z "$RH_REGISTRY_USER" || -z "$RH_REGISTRY_TOKEN" ]]; then
    echo "RH_REGISTRY_USER and RH_REGISTRY_TOKEN  must be set"
    exit 1
fi

export DOCKER_CONF="$PWD/.docker"
mkdir -p "$DOCKER_CONF"

docker login -u="$QUAY_USER" -p="$QUAY_TOKEN" quay.io
docker login -u="$RH_REGISTRY_USER" -p="$RH_REGISTRY_TOKEN" registry.redhat.io


IMAGE_TAG=$(git rev-parse --short=7 HEAD)
IMAGE_PREFIX="quay.io/cloudservices/ibutsu-"

# Backend images
BACKEND_IMAGES=("backend" "scheduler" "worker" "flower")
for IMAGE in "${BACKEND_IMAGES[@]}"; do
    echo "---- BUILDING: $IMAGE ----"
    docker build -t "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" -f backend/docker/Dockerfile.$IMAGE ./backend/
    docker push "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}"
    docker tag "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
    docker push "${IMAGE_PREFIX}${IMAGE}:latest"
done

# Frontend image
IMAGE="frontend"
echo "---- BUILDING: $IMAGE ----"
docker build -t "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" -f frontend/docker/Dockerfile.$IMAGE ./frontend/
docker push "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}"
docker tag "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
docker push "${IMAGE_PREFIX}${IMAGE}:latest"
