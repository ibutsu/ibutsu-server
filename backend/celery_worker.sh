#!/bin/bash
# Start the Celery worker directly from the tasks module
# This avoids the circular import with queues.py
celery --app ibutsu_server.tasks:_celery_app --no-color worker --events
