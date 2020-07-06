#!/bin/bash

BUILD_TYPE=$1
BUILD_TYPES=(html dirhtml singlehtml pickle json htmlhelp qthelp devhelp epub latex latexpdf latexpdfja text man texinfo info gettext xml pseudoxml)

if [[ "$BUILD_TYPE" == "" ]]; then
    BUILD_TYPE=html
fi

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SOURCE_DIR="${BASE_DIR}/source"
BUILD_DIR="${BASE_DIR}/build/$BUILD_TYPE"

if [[ ! `command -v inotifywait` ]]; then
    echo "inotifywait is not installed, please install the inotify-tools package"
    exit 1
fi

if [[ ! " ${BUILD_TYPES[@]} " =~ " ${BUILD_TYPE} " ]]; then
    echo "Build type '${BUILD_TYPE}' is not supported, it has to be one of the following:"
    echo "  ${BUILD_TYPES[@]}"
    exit 2
fi

inotifywait -e close_write -r -m $SOURCE_DIR |
while read -r DIRECTORY EVENTS FILENAME; do
    if [ ${FILENAME: -4} == ".rst" ]; then
        cd $BUILD_DIR
        rm -fr *
        cd $BASE_DIR
        make $BUILD_TYPE
    fi
done;
