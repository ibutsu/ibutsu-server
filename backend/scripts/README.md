# Backend Scripts

This directory contains utility scripts for managing the Ibutsu backend.

## Database Initialization Script

### `init_db.py`

Automated database schema initialization for development environments.

**What it does:**
1. Checks database connectivity
2. Creates the initial Alembic migration if none exists
3. Runs all pending migrations to bring the database to the latest schema

**Usage:**

```bash
# From the backend directory
python scripts/init_db.py
```

**When to use:**
- Automatically called during container/pod startup in development environments
- Can be run manually when setting up a fresh database
- Safe to run multiple times (idempotent)

**Environment variables required:**
- `POSTGRESQL_HOST` or `POSTGRES_HOST` - Database host
- `POSTGRESQL_DATABASE` or `POSTGRES_DATABASE` - Database name
- `POSTGRESQL_USER` or `POSTGRES_USER` - Database user
- `POSTGRESQL_PASSWORD` or `POSTGRES_PASSWORD` - Database password
- `POSTGRESQL_PORT` or `POSTGRES_PORT` - Database port (optional, defaults to 5432)

**For production:**
Database migrations should be managed manually using Alembic commands:
```bash
# Check current revision
alembic current

# Show pending migrations
alembic history

# Apply migrations
alembic upgrade head
```

See `alembic/README.md` for more details on manual migration management.

## Integration Points

This script is automatically called by:
- `scripts/ibutsu-pod.sh` - Podman-based development environment
- `docker-compose.dev.yml` - Docker Compose development setup
- `docker/Dockerfile.backend` - Production container builds

The script ensures the database schema is always up-to-date before the application starts.
