#!/bin/bash

function print_usage() {
    echo "Usage: podman_build.sh [-h|--help] [--local-tag] [backend|scheduler|worker|flower|frontend]"
    echo ""
    echo "optional arguments:"
    echo "  -h            show this help message"
    echo "  -l            use a tag with no registry specified"
    echo "  images*        images to build, or nothing to build all images"
    echo ""
}

# Defaults for output
IMAGE_PREFIX="quay.io/ibutsu/"
IMAGES_TO_BUILD=("backend" "scheduler" "worker" "flower" "frontend")

# Parse the options
while getopts ':lh' OPTION
do
    case "${OPTION}" in
      h) print_usage; exit 0;;
      l) IMAGE_PREFIX="ibutsu/";;
      *) print_usage; exit 1;;
    esac
done

# Handle the image args
shift $((OPTIND - 1))
if [[ "$1" != "" ]]; then
    IMAGES_TO_BUILD=("$1")
fi

# 7 char SHA for tagging
IMAGE_TAG=$(git rev-parse --short=7 HEAD)

# Let the user know what we're going to do
printf "\nCurrent SHA for image tags: %s\n" ${IMAGE_TAG}
echo "Building image(s): ${IMAGES_TO_BUILD[*]}"


# Iterate and build images sequentially
declare -A RESULTS
for IMAGE in "${IMAGES_TO_BUILD[@]}"; do
    printf -- "\n---------------- BUILDING: %s%s:%s ----------------\n" ${IMAGE_PREFIX} ${IMAGE} ${IMAGE_TAG}
    if [[ "${IMAGE}" == "frontend" ]]; then
        BASE_DIR=frontend
    else
        BASE_DIR=backend
    fi
    podman build -t "${IMAGE_PREFIX}${IMAGE}:${IMAGE_TAG}" -f $BASE_DIR/docker/Dockerfile.$IMAGE ./$BASE_DIR/
    RESULTS[${IMAGE}]=$?
done

# dump results to console at the end
echo "BUILD RESULTS:"
for IMAGE in "${!RESULTS[@]}"; do
    printf "%s: %d\n" $IMAGE ${RESULTS[${IMAGE}]}
done
