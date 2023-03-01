#!/usr/bin/env bash

# For the frontend container we follow a similar approach to option 4 in:
# https://levelup.gitconnected.com/handling-multiple-environments-in-react-with-docker-543762989783
# We do this so that we can have runtime env vars for our REACT application.
# Build the public/settings.js file with ENV variables
echo "window.settings = {};" > build/settings.js
if [[ ! -z "${REACT_APP_SERVER_URL}" ]]; then
  echo "window.settings.serverUrl='${REACT_APP_SERVER_URL}';" >> build/settings.js
else
  echo "window.settings.serverUrl='http://localhost:8080/api}';}" >> build/settings.js
fi
if [[ ! -z "${NODE_ENV}" ]]; then
  echo "window.settings.environment='${NODE_ENV}';" >> build/settings.js
else
  echo "window.settings.environment='development';" >> build/settings.js
fi

npm run -d start
