#!/bin/bash +x

DC=$(command -v docker-compose)
NPM=$(command -v npm)
YARN=$(command -v yarn)
CURDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
FEDIR="$CURDIR/frontend"

if [[ "$DC" == "" ]]; then
    echo "docker-compose is not installed. Please install docker-compose and run the build script again."
    exit 1
fi
if [[ "$NPM" == "" ]]; then
    echo "npm is not installed. Please install npm and run the build script again."
    exit 1
fi
if [[ "$YARN" == "" ]]; then
    echo "yarn is not installed, installing..."
    cd "$FEDIR" || exit
    npm install --prefix "$FEDIR" yarn
    YARN=$FEDIR/node_modules/.bin/yarn
    if ! npm install --prefix "$FEDIR" yarn; then
        echo "There was an error installing yarn"
        exit 1
    fi
fi
cd "$FEDIR" || exit
echo "Installing frontend packages"
$YARN -s install
if ! $YARN -s install; then
    echo "There was a problem running yarn"
    exit 1
fi
echo "Building frontend"
if ! $YARN build > /dev/null; then
    echo "There was a problem building the frontend"
    exit 1
fi
cd "$CURDIR" || exit
$DC build
