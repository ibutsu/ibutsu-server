.. _examples/compose:

Docker/Podman Compose
=====================

.. code:: yaml

   version: '3'
   services:
     frontend:
       environment:
         NODE_ENV: production
         REACT_APP_SERVER_URL: http://localhost:8080/api
       build:
         context: ./frontend
         dockerfile: docker/Dockerfile.frontend
       image: ibutsu/frontend
       ports:
         - "3000:8080"
       depends_on:
         - backend
     backend:
       environment:
         APP_CONFIG: config.py
         POSTGRESQL_HOST: postgres
         POSTGRESQL_DATABASE: ibutsu
         CELERY_BROKER_URL: 'redis://redis'
         CELERY_RESULT_BACKEND: 'redis://redis'
       build:
         context: ./backend
         dockerfile: docker/Dockerfile.backend
       image: ibutsu/backend
       ports:
         - "8080:8080"
       depends_on:
         - postgres
         - redis
     postgres:
       environment:
         POSTGRES_USER: ibutsu
         POSTGRES_PASSWORD: ibutsu
         POSTGRES_DB: ibutsu
       image: postgres:latest
     worker:
       environment:
         POSTGRESQL_HOST: postgres
         POSTGRESQL_DATABASE: ibutsu
         CELERY_BROKER_URL: 'redis://redis'
         CELERY_RESULT_BACKEND: 'redis://redis'
       build:
         context: ./backend
         dockerfile: docker/Dockerfile.worker
       image: ibutsu/worker
       command: /bin/bash -c 'celery --app ibutsu_server.celery_app:worker_app --no-color worker --events'
       depends_on:
         - backend
         - postgres
         - redis
     scheduler:
       build:
         context: ./backend
         dockerfile: docker/Dockerfile.scheduler
       image: ibutsu/scheduler
       environment:
         POSTGRESQL_HOST: postgres
         POSTGRESQL_DATABASE: ibutsu
         CELERY_BROKER_URL: 'redis://redis'
         CELERY_RESULT_BACKEND: 'redis://redis'
       depends_on:
         - backend
         - postgres
         - redis
     redis:
       image: redis:latest
