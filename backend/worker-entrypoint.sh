#!/bin/bash

# give some more time for backend container
sleep 30

# create the venv (it will not fail if already exists) and activate
python -m venv .ibutsu_env && source .ibutsu_env/bin/activate

# all the packages should be installed in backend container, waiting for it
until pip show ibutsu-server; do
  >&2 echo "Waiting for backend"
  sleep 5
done

# start the worker
./celery_worker.sh
