#!/bin/bash

# wait for the backend to start up
timeout 120 bash -c 'until printf "" 2>>/dev/null >>/dev/tcp/backend/8080; do sleep 3; done'

# get the auth token
response=$(curl -s -X POST http://backend:8080/api/login \
    -H 'accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{\"email\": \"${IBUTSU_SUPERADMIN_EMAIL}\", \"password\": \"${IBUTSU_SUPERADMIN_PASSWORD}\"}")

token=$(jq -r '.token' <<< "${response}")

st run http://backend:8080/api/openapi.json -H "Authorization: Bearer ${token}"
