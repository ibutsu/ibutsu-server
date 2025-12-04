.. _examples/okd-template:

OKD/OpenShift Template
======================

.. code:: yaml

  kind: Template
  apiVersion: v1
  metadata:
    name: ibutsu-template
  objects:
  # ===============================================
  # Frontend
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-frontend
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: ibutsu-frontend
      strategy:
        type: Rolling
      template:
        metadata:
          labels:
            app: ${APP_NAME}
            deploymentConfig: ibutsu-frontend
        spec:
          containers:
          - env:
              - name: REACT_APP_SERVER_URL
                value: ${BACKEND_ROUTE}
              - name: NODE_ENV
                value: production
          - image: frontend
            imagePullPolicy: Always
            livenessProbe:
              failureThreshold: 3
              httpGet:
                path: /
                port: 8080
                scheme: HTTP
              initialDelaySeconds: 0
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 1
            name: ibutsu-frontend
            ports:
            - containerPort: 8080
              protocol: TCP
            readinessProbe:
              failureThreshold: 3
              httpGet:
                path: /
                port: 8080
                scheme: HTTP
              initialDelaySeconds: 5
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 1
            resources: {}
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
          dnsPolicy: ClusterFirst
          restartPolicy: Always
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - ibutsu-frontend
          from:
            kind: ImageStreamTag
            name: frontend:latest
            namespace: ${NAMESPACE}
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: frontend
      annotations:
        description: "The frontend of Ibutsu server"
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations: null
        from:
          kind: DockerImage
          name: quay.io/ibutsu/frontend
        generation: 3
        importPolicy:
          scheduled: true
        name: latest
        referencePolicy:
          type: Source
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-frontend
      namespace: ${NAMESPACE}
    spec:
      ports:
      - port: 8080
        targetPort: 8080
      selector:
        deploymentConfig: ibutsu-frontend
  # -----------------------------------------------
  - kind: Route
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-frontend
      namespace: ${NAMESPACE}
      annotations:
        description: "A route to the frontend"
    spec:
      host: ${FRONTEND_ROUTE}
      to:
        kind: Service
        name: ibutsu-frontend
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
      wildcardPolicy: None
  # ===============================================
  # Backend
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-backend
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: ibutsu-backend
      strategy:
        type: Rolling
      template:
        metadata:
          labels:
            app: ${APP_NAME}
            deploymentConfig: ibutsu-backend
        spec:
          containers:
          - env:
            - name: APP_CONFIG
              value: config.py
            - name: HAS_FRONTEND
              value: "false"
            - name: POSTGRESQL_HOST
              value: postgresql.${NAMESPACE}.svc
            - name: POSTGRESQL_PORT
              value: "5432"
            - name: POSTGRESQL_USER
              valueFrom:
                secretKeyRef:
                  key: database-user
                  name: postgresql
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: postgresql
            - name: POSTGRESQL_DATABASE
              valueFrom:
                secretKeyRef:
                  key: database-name
                  name: postgresql
            - name: CELERY_BROKER_URL
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: CELERY_RESULT_BACKEND
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: FRONTEND_URL
              value: ${FRONTEND_ROUTE}
            - name: BACKEND_URL
              value: ${BACKEND_ROUTE}
            image: backend
            imagePullPolicy: Always
            livenessProbe:
              failureThreshold: 3
              httpGet:
                path: /
                port: 8080
                scheme: HTTP
              initialDelaySeconds: 0
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 1
            name: ibutsu-backend
            ports:
            - containerPort: 8080
              protocol: TCP
            readinessProbe:
              failureThreshold: 3
              httpGet:
                path: /
                port: 8080
                scheme: HTTP
              initialDelaySeconds: 5
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 1
            resources: {}
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
          dnsPolicy: ClusterFirst
          restartPolicy: Always
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - ibutsu-backend
          from:
            kind: ImageStreamTag
            name: backend:latest
            namespace: ${NAMESPACE}
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: backend
      annotations:
        description: "The api of Ibutsu server"
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations: null
        from:
          kind: DockerImage
          name: quay.io/ibutsu/backend
        generation: 3
        importPolicy:
          scheduled: true
        name: latest
        referencePolicy:
          type: Source
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-backend
      namespace: ${NAMESPACE}
    spec:
      ports:
      - port: 8080
        targetPort: 8080
      selector:
        deploymentConfig: ibutsu-backend
  # -----------------------------------------------
  - kind: Route
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-backend
      namespace: ${NAMESPACE}
      annotations:
        description: "A route to the backend"
    spec:
      host: ${BACKEND_ROUTE}
      to:
        kind: Service
        name: ibutsu-backend
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
  # ===============================================
  # Worker
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-worker
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: ibutsu-worker
      strategy:
        type: Rolling
      template:
        metadata:
          labels:
            app: ${APP_NAME}
            deploymentConfig: ibutsu-worker
        spec:
          containers:
          - env:
            - name: POSTGRESQL_HOST
              value: postgresql.${NAMESPACE}.svc
            - name: POSTGRESQL_PORT
              value: "5432"
            - name: POSTGRESQL_USER
              valueFrom:
                secretKeyRef:
                  key: database-user
                  name: postgresql
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: postgresql
            - name: POSTGRESQL_DATABASE
              valueFrom:
                secretKeyRef:
                  key: database-name
                  name: postgresql
            - name: CELERY_BROKER_URL
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: CELERY_RESULT_BACKEND
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: FRONTEND_URL
              value: ${FRONTEND_ROUTE}
            - name: BACKEND_URL
              value: ${BACKEND_ROUTE}
            image: worker
            imagePullPolicy: Always
            name: ibutsu-worker
            resources: {}
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
          dnsPolicy: ClusterFirst
          restartPolicy: Always
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - ibutsu-worker
          from:
            kind: ImageStreamTag
            name: worker:latest
            namespace: ${NAMESPACE}
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: worker
      annotations:
        description: "The celery worker of Ibutsu server"
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations: null
        from:
          kind: DockerImage
          name: quay.io/ibutsu/worker
        generation: 3
        importPolicy:
          scheduled: true
        name: latest
        referencePolicy:
          type: Source
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-worker
      namespace: ${NAMESPACE}
    spec:
      ports:
      - port: 8080
        targetPort: 8080
      selector:
        deploymentConfig: ibutsu-worker
  # ===============================================
  # Scheduler
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-scheduler
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: ibutsu-scheduler
      strategy:
        type: Rolling
      template:
        metadata:
          labels:
            app: ${APP_NAME}
            deploymentConfig: ibutsu-scheduler
        spec:
          containers:
          - env:
            - name: POSTGRESQL_HOST
              value: postgresql.${NAMESPACE}.svc
            - name: POSTGRESQL_PORT
              value: "5432"
            - name: POSTGRESQL_USER
              valueFrom:
                secretKeyRef:
                  key: database-user
                  name: postgresql
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: postgresql
            - name: POSTGRESQL_DATABASE
              valueFrom:
                secretKeyRef:
                  key: database-name
                  name: postgresql
            - name: CELERY_BROKER_URL
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: CELERY_RESULT_BACKEND
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            - name: FRONTEND_URL
              value: ${FRONTEND_ROUTE}
            - name: BACKEND_URL
              value: ${BACKEND_ROUTE}
            image: scheduler
            imagePullPolicy: Always
            name: ibutsu-scheduler
            resources: {}
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
          dnsPolicy: ClusterFirst
          restartPolicy: Always
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - ibutsu-scheduler
          from:
            kind: ImageStreamTag
            name: scheduler:latest
            namespace: ${NAMESPACE}
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: scheduler
      annotations:
        description: "Celery beat scheduler for periodic tasks in Ibutsu server"
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations: null
        from:
          kind: DockerImage
          name: quay.io/ibutsu/scheduler
        generation: 3
        importPolicy:
          scheduled: true
        name: latest
        referencePolicy:
          type: Source
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ibutsu-scheduler
      namespace: ${NAMESPACE}
    spec:
      ports:
      - port: 8080
        targetPort: 8080
      selector:
        deploymentConfig: ibutsu-scheduler
  # ===============================================
  # Flower
  # ===============================================
  - kind: BuildConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: celery-flower
      namespace: ${NAMESPACE}
    spec:
      source:
        type: Git
        git:
          uri: ${IBUTSU_REPO_URL}
          ref: ${IBUTSU_REPO_BRANCH}
        contextDir: backend
      strategy:
        dockerStrategy:
          dockerfilePath: docker/Dockerfile.flower
          env:
            - name: GIT_SSL_NO_VERIFY
              value: 'true'
        type: Docker
      output:
        to:
          kind: ImageStreamTag
          name: celery-flower:latest
      runPolicy: Serial
      triggers:
        - type: ConfigChange
        - imageChange:
          type: ImageChange
  # -----------------------------------------------
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: celery-flower
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: celery-flower
      strategy:
        type: Rolling
      template:
        metadata:
          labels:
            app: ${APP_NAME}
            deploymentConfig: celery-flower
        spec:
          containers:
          - env:
            - name: BROKER_URL
              value: redis://:${REDIS_PASSWORD}@redis.${NAMESPACE}.svc
            image: celery-flower
            imagePullPolicy: Always
            name: celery-flower
            resources: {}
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
          dnsPolicy: ClusterFirst
          restartPolicy: Always
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - celery-flower
          from:
            kind: ImageStreamTag
            name: celery-flower:latest
            namespace: ${NAMESPACE}
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: celery-flower
      annotations:
        description: "A monitoring application for Celery task queues"
        openshift.io/image.insecureRepository: "true"
    spec:
      lookupPolicy:
        local: true
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: celery-flower
      namespace: ${NAMESPACE}
    spec:
      ports:
      - port: 8080
        targetPort: 5555
      selector:
        deploymentConfig: celery-flower
  # -----------------------------------------------
  - kind: Route
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: celery-flower
      namespace: ${NAMESPACE}
      annotations:
        description: "A route to Celery Flower"
    spec:
      host: ${BACKEND_ROUTE}
      to:
        kind: Service
        name: celery-flower
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
  # ===============================================
  # PostgreSQL
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
        template: postgresql-persistent-template
      name: postgresql
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        name: postgresql
      strategy:
        resources: {}
        type: Recreate
      template:
        metadata:
          labels:
            deploymentConfig: postgresql
        spec:
          containers:
          - env:
            - name: POSTGRESQL_DATABASE
              valueFrom:
                secretKeyRef:
                  key: database-name
                  name: postgresql
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: postgresql
            - name: POSTGRESQL_USER
              valueFrom:
                secretKeyRef:
                  key: database-user
                  name: postgresql
            image: postgresql:12
            imagePullPolicy: IfNotPresent
            livenessProbe:
              exec:
                command:
                - /usr/libexec/check-container
                - --live
              initialDelaySeconds: 120
              timeoutSeconds: 10
            name: postgresql
            ports:
            - containerPort: 5432
              protocol: TCP
            readinessProbe:
              exec:
                command:
                - /usr/libexec/check-container
              initialDelaySeconds: 5
              timeoutSeconds: 1
            resources:
              limits:
                memory: 512Mi
            securityContext:
              capabilities: {}
              privileged: false
            terminationMessagePath: /dev/termination-log
            volumeMounts:
            - mountPath: /var/lib/pgsql/data
              name: postgresql-data
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          volumes:
          - name: postgresql-data
            persistentVolumeClaim:
              claimName: postgresql
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
          - postgresql
          from:
            kind: ImageStreamTag
            name: postgresql:12
            namespace: openshift
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: postgresql
      namespace: ${NAMESPACE}
    spec:
      ports:
      - name: postgresql
        port: 5432
        protocol: TCP
        targetPort: 5432
      selector:
        deploymentConfig: postgresql
  # -----------------------------------------------
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: postgresql
      namespace: ${NAMESPACE}
    spec:
      accessModes:
        - ReadWriteOnce
      resources:
        requests:
          storage: ${POSTGRESQL_STORAGE}
      volumeName: postgresql-data
  # -----------------------------------------------
  - kind: Secret
    apiVersion: v1
    metadata:
      name: postgresql
      namespace: ${NAMESPACE}
    type: opaque
    stringData:
      database-name: ${POSTGRESQL_DATABASE}
      database-password: ${POSTGRESQL_PASSWORD}
      database-user: ${POSTGRESQL_USER}
  # ===============================================
  # Redis
  # ===============================================
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
        template: redis-persistent-template
      name: redis
      namespace: ${NAMESPACE}
    spec:
      replicas: 1
      selector:
        deploymentConfig: redis
      strategy:
        type: Recreate
      template:
        metadata:
          labels:
            deploymentConfig: redis
        spec:
          containers:
          - env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: redis
            image: redis
            imagePullPolicy: IfNotPresent
            livenessProbe:
              failureThreshold: 3
              initialDelaySeconds: 30
              periodSeconds: 10
              successThreshold: 1
              tcpSocket:
                port: 6379
              timeoutSeconds: 1
            name: redis
            ports:
            - containerPort: 6379
              protocol: TCP
            readinessProbe:
              exec:
                command:
                - /bin/sh
                - '-i'
                - '-c'
                - >-
                  test "$(redis-cli -h 127.0.0.1 -a $REDIS_PASSWORD ping)" ==
                  "PONG"
              failureThreshold: 3
              initialDelaySeconds: 5
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 1
            resources:
              limits:
                memory: 512Mi
            securityContext:
              capabilities: {}
              privileged: false
            terminationMessagePath: /dev/termination-log
            terminationMessagePolicy: File
            volumeMounts:
            - mountPath: /var/lib/redis/data
              name: redis-data
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          volumes:
          - name: redis-data
            persistentVolumeClaim:
              claimName: redis
      triggers:
      - imageChangeParams:
          automatic: true
          containerNames:
            - redis
          from:
            kind: ImageStreamTag
            name: redis:3.2
            namespace: openshift
        type: ImageChange
      - type: ConfigChange
  # -----------------------------------------------
  - kind: Service
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: redis
      namespace: ${NAMESPACE}
    spec:
      ports:
        - port: 6379
          targetPort: 6379
      selector:
        deploymentConfig: redis
  # -----------------------------------------------
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: redis
      namespace: ${NAMESPACE}
    spec:
      accessModes:
        - ReadWriteOnce
      resources:
        requests:
          storage: ${REDIS_STORAGE}
      volumeName: redis-data
  # -----------------------------------------------
  - kind: Secret
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: redis
      namespace: ${NAMESPACE}
    type: opaque
    stringData:
      database-password: ${REDIS_PASSWORD}
  # ===============================================
  # Database Backup
  # ===============================================
  - kind: CronJob
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: database-backup
      namespace: ${NAMESPACE}
    spec:
      schedule: ${BACKUP_SCHEDULE}
      concurrencyPolicy: Forbid
      jobTemplate:
        spec:
          template:
            spec:
              volumes:
                - name: database-backups
                  persistentVolumeClaim:
                    claimName: ${BACKUP_VOLUME_CLAIM}
              containers:
                - name: postgresql-backup
                  image: postgresql:12
                  command:
                    - 'bash'
                    - '-eo'
                    - 'pipefail'
                    - '-c'
                    - >
                      trap "echo 'Backup failed'; exit 0" ERR;
                      FILENAME=backup-${PGDATABASE}-`date +%Y-%m-%d`.dump;
                      cd /var/lib/database-backup;
                      find . -type f -name "backup-${PGDATABASE}-*" -exec ls -ltr "{}" + | head -n -${BACKUP_KEEP} | xargs rm -fr;
                      echo "Backing up database...";
                      PGPASSWORD="$PGPASSWORD" pg_dump -v --username=$PGUSER --host=$PGHOST --port=$PGPORT --dbname=$PGDATABASE --exclude-table=artifacts --format=custom --compress=9 --jobs=1 --no-owner --file=$FILENAME;
                      echo "";
                      echo -n "Backup successful: "; du -h ./$FILENAME;
                      echo "To restore, use:";
                      echo "~# pg_restore --user=$PGUSER --password=<PGPASSWD> --host=$PGHOST --port=$PGPORT --database=$PGDATABASE $FILENAME"
                  resources:
                  limits:
                    cpu: 250m
                    memory: 1Gi
                  requests:
                    cpu: 100m
                    memory: 512Mi
                  env:
                    - name: PGHOST
                      value: postgresql.${NAMESPACE}.svc
                    - name: PGPORT
                      value: "5432"
                    - name: PGUSER
                      valueFrom:
                        secretKeyRef:
                          key: database-user
                          name: postgresql
                    - name: PGPASSWORD
                      valueFrom:
                        secretKeyRef:
                          key: database-password
                          name: postgresql
                    - name: PGDATABASE
                      valueFrom:
                        secretKeyRef:
                          key: database-name
                          name: postgresql
                    - name: BACKUP_KEEP
                      value: ${BACKUP_KEEP}
                  volumeMounts:
                    - name: database-backups
                      mountPath: /var/lib/database-backup
              restartPolicy: Never
  # -----------------------------------------------
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      labels:
        app: ${APP_NAME}
      name: ${BACKUP_VOLUME_CLAIM}
      namespace: ${NAMESPACE}
    spec:
      accessModes:
        - ReadWriteOnce
      resources:
        requests:
          storage: ${BACKUP_STORAGE}
      volumeName: backup-data
  # ===============================================
  # Parameters
  # ===============================================
  parameters:
  - name: POSTGRESQL_USER
    displayName: PostgreSQL User
    description: The username for authentication in PostgreSQL
    generate: expression
    from: 'user[\a\d]{4}'
  - name: POSTGRESQL_PASSWORD
    displayName: PostgreSQL Password
    description: The password for the PostgreSQL user
    generate: expression
    from: '[\w]{16}'
  - name: POSTGRESQL_DATABASE
    displayName: PostgreSQL Database
    description: The name of the database to use in PostgreSQL
    value: ibutsu
  - name: POSTGRESQL_STORAGE
    displayName: PostgreSQL Storage
    description: The amount of storage space for the database to use
    value: 80Gi
  - name: REDIS_PASSWORD
    displayName: Redis Password
    description: The password for Redis
    generate: expression
    from: '[\w]{16}'
  - name: REDIS_STORAGE
    displayName: Redis Storage
    description: The amount of storage space for Redis to use
    value: 2Gi
  - name: IBUTSU_REPO_URL
    displayName: Ibutsu Repository URL
    description: The URL of the git repository with the Ibutsu server source code
    value: https://github.com/ibutsu/ibutsu-server.git
  - name: IBUTSU_REPO_BRANCH
    displayName: Ibutsu Repository Branch
    description: The branch to pull the code from (defaults to main)
    value: main
  - name: APP_NAME
    displayName: App Name
    description: The name of the application
    value: ibutsu-server
  - name: NAMESPACE
    displayName: Namespace
    description: The namespace for all of the images, applications, etc.
    value: ibutsu-server
  - name: FRONTEND_ROUTE
    displayName: Frontend Route
    description: The URL of the frontend of the Ibutsu server
    value: ibutsu.example.com
  - name: BACKEND_ROUTE
    displayName: Backend Route
    description: The URL of the backend of the Ibutsu server
    value: ibutsu-api.example.com
  - name: BACKUP_VOLUME_CLAIM
    displayName: Backup volume claim
    value: database-backup
  - name: BACKUP_STORAGE
    displayName: Backup storage
    value: 30Gi
  - name: BACKUP_KEEP
    displayName: Number of backups to keep
    value: '5'
  - name: BACKUP_SCHEDULE
    displayName: Cron-like schedule to run backup
    value: '1 0 * * 6'
