#!/bin/bash

# Set some basic variables
SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BASE_DIR="$( dirname "$SCRIPTS_DIR" )"
NEW_VERSION=

# Ensure uv is in PATH if available in backend/.venv/bin
if ! command -v uv >/dev/null 2>&1; then
    if [[ -x "$BASE_DIR/backend/.venv/bin/uv" ]]; then
        export PATH="$BASE_DIR/backend/.venv/bin:$PATH"
    fi
fi

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

# Function to extract current version using uv
function get_current_version() {
    uv version --short --project "$BASE_DIR/backend"
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
    echo "Error: Could not determine current version using uv" >&2
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

# Update backend pyproject.toml and uv.lock using uv
echo "  Updating backend version with uv"
uv version "$NEW_VERSION" --project "$BASE_DIR/backend"

# Update openapi.yaml
OPENAPI_FILE="$BASE_DIR/backend/ibutsu_server/openapi/openapi.yaml"
if [[ -f "$OPENAPI_FILE" ]]; then
    echo "  Updating: backend/ibutsu_server/openapi/openapi.yaml"
    sed -i "s/^  version: .*/  version: $NEW_VERSION/" "$OPENAPI_FILE"
fi

# Update frontend/package.json
PACKAGE_JSON="$BASE_DIR/frontend/package.json"
if [[ -f "$PACKAGE_JSON" ]]; then
    echo "  Updating: frontend/package.json"
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
fi

# If node is present, call frontend/bin/write-version-file.cjs
if command -v node >/dev/null 2>&1 && [[ -f "$BASE_DIR/frontend/bin/write-version-file.cjs" ]]; then
    echo "  Generating frontend/public/version.json"
    (cd "$BASE_DIR/frontend" && node bin/write-version-file.cjs)
fi

# Stage modified files
STAGED_FILES=(
    "$BASE_DIR/backend/pyproject.toml"
    "$BASE_DIR/backend/uv.lock"
    "$BASE_DIR/backend/ibutsu_server/openapi/openapi.yaml"
    "$BASE_DIR/frontend/package.json"
)

if [[ -f "$BASE_DIR/frontend/public/version.json" ]]; then
    STAGED_FILES+=("$BASE_DIR/frontend/public/version.json")
fi

git -C "$BASE_DIR" add "${STAGED_FILES[@]}"

echo ""
echo "Version update complete!"
echo ""
echo "Files staged for commit:"
for FNAME in "${STAGED_FILES[@]}"; do
    if [[ -f "$FNAME" ]]; then
        echo "  - ${FNAME/$BASE_DIR\//}"
    fi
done
