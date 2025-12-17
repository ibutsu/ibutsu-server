#!/usr/bin/env bash
set -euo pipefail

# Create settings.js with runtime environment variables
# This allows runtime configuration of React app without rebuilding
# See: https://levelup.gitconnected.com/handling-multiple-environments-in-react-with-docker-543762989783

echo "Generating settings.js with runtime configuration..."

# Ensure build directory exists
mkdir -p /opt/app-root/src/build

# Use node to safely JSON-serialize environment variables
# This prevents injection attacks from special characters in env values
node -e "
const settings = {
  serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:8080/api',
  environment: process.env.NODE_ENV || 'development'
};
console.log('window.settings = ' + JSON.stringify(settings) + ';');
" > /opt/app-root/src/build/settings.js

echo "Settings configured:"
cat /opt/app-root/src/build/settings.js

# Start the application
exec "$@"
