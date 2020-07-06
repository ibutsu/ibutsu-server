.. _examples/compose:

Docker/Podman Compose
=====================

.. code:: yaml

   version: '3'
   services:
     frontend:
       environment:
         NODE_ENV: production
         REACT_APP_SERVER_URL: http://localhost:8081/api
       image: ibutsu/frontend
       ports:
         - "8080:8080"
       links:
         - backend
     backend:
       environment:
         ENV_FOR_DYNACONF: production
         DYNACONF_CELERY_BROKER_URL: redis://redis:6379
         DYNACONF_CELERY_RESULT_BACKEND: redis://redis:6379
         DYNACONF_HOST: mongo
         DYNACONF_DATABASE: test_artifacts
       image: ibutsu/backend
       ports:
         - "8081:80"
       links:
         - mongo
         - redis
     worker:
       image: ibutsu/worker
       links:
         - mongo
         - redis
     monitor:
       image: ibutsu/monitor
       links:
         - mongo
         - redis
     mongo:
       image: mongo
       ports:
         - "27017:27017"
     redis:
       image: redis
       ports:
         - "6379:6379"
