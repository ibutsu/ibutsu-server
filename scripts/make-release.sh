#!/bin/bash

# Set some basic variables
SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BASE_DIR="$( dirname "$SCRIPTS_DIR" )"
NEW_VERSION=
VERSIONED_FILES=( "$BASE_DIR/backend/pyproject.toml" "$BASE_DIR/backend/ibutsu_server/openapi/openapi.yaml" "$BASE_DIR/frontend/package.json" )

function print_usage() {
    echo "Usage: make-release.sh [-h|--help] [VERSION]"
    echo ""
    echo "This script updates version numbers in frontend and backend files."
    echo ""
    echo "optional arguments:"
    echo "  -h, --help       show this help message"
    echo "  VERSION          the new version (if omitted, you will be prompted)"
    echo ""
}

# Function to extract current version from pyproject.toml
function get_current_version() {
    grep -m1 '^version = ' "$BASE_DIR/backend/pyproject.toml" | sed 's/version = "\(.*\)"/\1/'
}

# Function to increment semantic version
function increment_version() {
    local version=$1
    local major minor patch

    # Split version into major.minor.patch
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    major="${VERSION_PARTS[0]}"
    minor="${VERSION_PARTS[1]}"
    patch="${VERSION_PARTS[2]}"

    # Increment patch version
    patch=$((patch + 1))

    echo "${major}.${minor}.${patch}"
}

# Parse the arguments
while (( "$#" )); do
    case "$1" in
        -h|--help)
            print_usage
            exit 0
            ;;
        -*)
            echo "Error: unsupported option $1" >&2
            exit 1
            ;;
        *)
            NEW_VERSION="$1"
            shift
            ;;
    esac
done

# Get current version
CURRENT_VERSION=$(get_current_version)

if [[ -z "$CURRENT_VERSION" ]]; then
    echo "Error: Could not determine current version from pyproject.toml" >&2
    exit 1
fi

echo "Current version: $CURRENT_VERSION"

# If no version provided, prompt the user
if [[ -z "$NEW_VERSION" ]]; then
    DEFAULT_VERSION=$(increment_version "$CURRENT_VERSION")
    echo ""
    read -r -p "Enter new version [$DEFAULT_VERSION]: " NEW_VERSION
    NEW_VERSION="${NEW_VERSION:-$DEFAULT_VERSION}"
fi

echo ""
echo "Updating files from $CURRENT_VERSION to $NEW_VERSION"
echo ""

# Escape all relevant regex special characters in current version for sed
SED_VERSION=${CURRENT_VERSION//./\\.}

# Update each file
for FNAME in "${VERSIONED_FILES[@]}"; do
    if [[ -f "$FNAME" ]]; then
        echo "  Updating: ${FNAME/$BASE_DIR\//}"
        sed -i "s/$SED_VERSION/$NEW_VERSION/g" "$FNAME"
        if ! sed -i "s/$SED_VERSION/$NEW_VERSION/g" "$FNAME"; then
            echo "  Error: Failed to update ${FNAME/$BASE_DIR\//}" >&2
            exit 1
        fi
    else
        echo "  Warning: File not found: ${FNAME/$BASE_DIR\//}"
    fi
done

echo ""
echo "Version update complete!"
echo ""
echo "Files updated:"
for FNAME in "${VERSIONED_FILES[@]}"; do
    if [[ -f "$FNAME" ]]; then
        echo "  - ${FNAME/$BASE_DIR\//}"
    fi
done
