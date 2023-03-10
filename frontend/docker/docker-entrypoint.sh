#!/usr/bin/env bash

/bin/ln -sf /dev/stdout /var/log/nginx/access.log
/bin/ln -sf /dev/stderr /var/log/nginx/error.log

# For the frontend container we follow a similar approach to option 4 in:
# https://levelup.gitconnected.com/handling-multiple-environments-in-react-with-docker-543762989783
# We do this so that we can have runtime env vars for our REACT application.
# Build the public/settings.js file with ENV variables
echo "window.settings = {};" > settings.js
if [[ ! -z "${REACT_APP_SERVER_URL}" ]]; then
  echo "window.settings.serverUrl='${REACT_APP_SERVER_URL}';" >> settings.js
else
  echo "window.settings.serverUrl='http://localhost:8080/api';" >> settings.js
fi
if [[ ! -z "${NODE_ENV}" ]]; then
  echo "window.settings.environment='${NODE_ENV}';" >> settings.js
else
  echo "window.settings.environment='development';" >> settings.js
fi

exec "$@"
