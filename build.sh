#!/bin/bash +x

DC=$(command -v docker-compose)
CURDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
FEDIR="$CURDIR/frontend"

if [[ "$DC" == "" ]]; then
    echo "docker-compose is not installed. Please install docker-compose and run the build script again."
    exit 1
fi

# Yarn 4 is managed by corepack (ships with Node.js 18+).
# Running `corepack enable` makes the yarn binary available; corepack will
# automatically download the exact Yarn version declared in frontend/package.json
# (via the "packageManager" field) on first invocation.
corepack enable

cd "$FEDIR" || exit
echo "Installing frontend packages"
if ! yarn install; then
    echo "There was a problem running yarn"
    exit 1
fi
echo "Building frontend"
if ! yarn build > /dev/null; then
    echo "There was a problem building the frontend"
    exit 1
fi
cd "$CURDIR" || exit
$DC build
