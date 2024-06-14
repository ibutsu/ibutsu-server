#!/bin/bash -x

# Make sure the backend is already running. docker-compose-fuzz does this with depends_on

# get the auth token
echo "Getting fuzz token... "
response=$(curl -s -X POST http://backend:8080/api/login \
    -H 'accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{\"email\": \"${IBUTSU_SUPERADMIN_EMAIL}\", \"password\": \"${IBUTSU_SUPERADMIN_PASSWORD}\"}")

token=$(jq -r '.token' <<< "${response}")

echo "Fuzz token acquired"

# ignore the health endpoint, because it does return 5xx
st run -E ^\(?\!/api/health\).* \
  http://backend:8080/api/openapi.json \
  -H "Authorization: Bearer ${token}" \
  --report reports/api-tests.tar.gz \
  --exitfirst \
  --wait-for-schema 60
