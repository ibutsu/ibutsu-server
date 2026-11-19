#!/bin/bash
set -e

# Activate virtualenv if present
if [[ -f "/app/.venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source /app/.venv/bin/activate
fi

# Support runtime environment-controlled migrations
# Controlled via deployment parameters:
# - RUN_MIGRATIONS: "true", "1", "yes"
# - INIT_DB: "true", "1", "yes"
if [[ "${RUN_MIGRATIONS:-}" =~ ^(true|1|yes)$ ]] || [[ "${INIT_DB:-}" =~ ^(true|1|yes)$ ]]; then
    echo "Initializing database schema..."
    python scripts/init_db.py
fi

print_help() {
    cat <<EOF
Supported container commands:

  web|server: start the production Gunicorn/Uvicorn ASGI server
  devserver:  start the development Uvicorn server with hot reload
  migrate:    run database migrations (scripts/init_db.py)
  help:       print this help message

Environment variables for deployment control:
  RUN_MIGRATIONS: set to "true" to automatically apply migrations on startup
  INIT_DB:        alias for RUN_MIGRATIONS
EOF
}

# If no arguments provided or first argument starts with a flag, default to gunicorn
if [[ $# -eq 0 ]] || [[ "${1#-}" != "$1" ]]; then
    exec gunicorn \
        -k uvicorn.workers.UvicornWorker \
        -c config.py \
        --bind 0.0.0.0:8080 \
        --access-logfile - \
        --error-logfile - \
        ibutsu_server:connexion_app "$@"
fi

case "$1" in
    help)
        print_help
        ;;
    web|server)
        shift
        exec gunicorn \
            -k uvicorn.workers.UvicornWorker \
            -c config.py \
            --bind 0.0.0.0:8080 \
            --access-logfile - \
            --error-logfile - \
            ibutsu_server:connexion_app "$@"
        ;;
    devserver|dev)
        shift
        exec uvicorn ibutsu_server:connexion_app --host 0.0.0.0 --port 8080 --reload "$@"
        ;;
    migrate|init-db)
        exec python scripts/init_db.py
        ;;
    legacy-ssl)
        exec python -m ibutsu_server --ssl
        ;;
    *)
        exec "$@"
        ;;
esac
