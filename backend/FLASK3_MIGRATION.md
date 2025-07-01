# Flask 3+ and Flask-SQLAlchemy 3+ Migration Guide

This document outlines the migration from Flask 2.x/Flask-SQLAlchemy 2.x to Flask 3+ and Flask-SQLAlchemy 3+ for the ibutsu-server backend.

## Key Changes Made

### 1. Dependencies Updated

**pyproject.toml changes:**
- `Flask>=3.0.0` → Latest Flask 3.x
- `Flask-SQLAlchemy>=3.0.0` → `Flask-SQLAlchemy>=3.1.0` (latest stable)
- `sqlalchemy>=1.4.18` → `sqlalchemy>=2.0.0` (SQLAlchemy 2.x for best compatibility)
- `werkzeug` → `werkzeug>=3.0.0` (explicit requirement)

### 2. Application Configuration

**Flask-SQLAlchemy 3.0+ Configuration:**
- `SQLALCHEMY_TRACK_MODIFICATIONS` now defaults to `False` (was `True`)
- Added explicit `SQLALCHEMY_ENGINE_OPTIONS` default
- Removed dependency on deprecated `SQLALCHEMY_COMMIT_ON_TEARDOWN`

### 3. Session Management

**Flask-SQLAlchemy 3.0+ Session Changes:**
- Session is now scoped to app context instead of thread
- Active Flask application context is always required to access `session` and `engine`
- Session cleanup is now handled explicitly in Celery tasks

### 4. Database Upgrade Compatibility

**SQLAlchemy Session Binding:**
- Replaced deprecated `session.get_bind()` with `session.bind` or `db.engine`
- Updated all database upgrade functions for Flask-SQLAlchemy 3.0+ compatibility

**SQLAlchemy 2.0+ Private API Compatibility:**
- Replaced deprecated `_literal_as_text` with `text()` function in `db/util.py`
- Updated `Explain` class for SQLAlchemy 2.0+ compatibility

### 5. ASGI Compatibility

The backend is now fully configured for ASGI deployment with:
- Connexion 3.x FlaskApp (ASGI-compatible)
- Starlette CORS middleware
- uvicorn ASGI server

## Breaking Changes Addressed

### Flask 3.0 Breaking Changes ✅
- ✅ Removed deprecated properties (session_cookie_name, etc.) - Not used
- ✅ Removed deprecated JSON config keys - Not used
- ✅ Removed before_first_request decorator - Not used
- ✅ Removed json_encoder/json_decoder - Not used
- ✅ Werkzeug >= 3.0.0 requirement - Added

### SQLAlchemy 2.0+ Breaking Changes ✅
- ✅ Removed `_literal_as_text` private API usage
- ✅ Updated database utility functions for 2.0+ compatibility

### Flask-SQLAlchemy 3.0 Breaking Changes ✅
- ✅ Session scoped to app context - Verified compatible
- ✅ Different bind keys use different MetaData - Compatible with single-DB setup
- ✅ SQLALCHEMY_DATABASE_URI explicit requirement - Already configured
- ✅ SQLite relative path to app.instance_path - Not using SQLite in production
- ✅ SQLALCHEMY_TRACK_MODIFICATIONS disabled by default - Updated
- ✅ SQLALCHEMY_COMMIT_ON_TEARDOWN deprecated - Removed dependency
- ✅ session.get_bind() compatibility - Updated all usages

## Testing Instructions

1. **Install Dependencies:**
   ```bash
   cd backend
   pip install -e .
   ```

2. **Run Database Migrations:**
   ```bash
   # The application will automatically run database upgrades on startup
   python -m ibutsu_server
   ```

3. **Verify Application Startup:**
   ```bash
   # Start the application
   python -m ibutsu_server

   # Check health endpoint
   curl http://localhost:8080/api/health
   ```

4. **Test Database Operations:**
   ```bash
   # Test basic CRUD operations
   curl -X POST http://localhost:8080/api/users \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "email": "test@example.com"}'
   ```

5. **Test Celery Tasks:**
   ```bash
   # Start Celery worker
   celery -A ibutsu_server.tasks worker --loglevel=info

   # Test task execution via API
   curl -X POST http://localhost:8080/admin/run-task \
     -H "Content-Type: application/json" \
     -d '{"task": "test_task"}'
   ```

## Validation Checklist

- [ ] Application starts without errors
- [ ] Database connections work
- [ ] Database migrations run successfully
- [ ] API endpoints respond correctly
- [ ] Celery tasks execute properly
- [ ] Session management works correctly
- [ ] CORS headers are present
- [ ] ASGI deployment works with uvicorn

## Known Compatibility Notes

1. **Session Lifecycle:** Flask-SQLAlchemy 3.0+ requires an active app context for all database operations. This is automatically handled in web requests but must be managed manually in Celery tasks (already implemented).

2. **Database Binding:** The updated session binding approach is backwards compatible but provides better support for Flask-SQLAlchemy 3.0+ patterns.

3. **Configuration Defaults:** Some configuration defaults have changed in Flask-SQLAlchemy 3.0+. All critical settings have been explicitly configured.

## Rollback Plan

If issues are encountered:

1. **Dependencies Rollback:**
   ```toml
   "Flask>=2.3.0,<3.0.0",
   "Flask-SQLAlchemy>=2.5.0,<3.0.0",
   "sqlalchemy>=1.4.18,<2.0.0",
   ```

2. **Configuration Rollback:**
   - Restore `SQLALCHEMY_TRACK_MODIFICATIONS = True`
   - Restore `SQLALCHEMY_COMMIT_ON_TEARDOWN` usage in Celery tasks

3. **Database Upgrades Rollback:**
   - Restore `session.get_bind()` calls in upgrades.py

The migration is designed to be minimally invasive and should not affect existing functionality while providing the benefits of Flask 3+ and Flask-SQLAlchemy 3+.
