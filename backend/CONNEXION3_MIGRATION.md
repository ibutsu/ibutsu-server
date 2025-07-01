# Connexion 3 Migration Notes

## Key Changes Applied

### 1. Application Type
- ✅ Changed from `connexion.App` to `connexion.FlaskApp`
- ✅ Return Connexion app instead of Flask app (`return app` not `return app.app`)

### 2. CORS Handling
- ❌ Removed `flask-cors` (no longer compatible)
- ✅ Added `starlette.middleware.cors.CORSMiddleware` as ASGI middleware
- ✅ Middleware added after `add_api()` call

### 3. Request Handling
- ✅ Replaced all `connexion.request` with `flask.request`
- ✅ Updated imports in all controllers

### 4. Dependencies
- ✅ Updated to `connexion[swagger-ui]>=3.0.0`
- ✅ Added `connexion[flask]>=3.0.0`
- ✅ Added `starlette` for CORS middleware
- ✅ Added `uvicorn[standard]` for ASGI server
- ❌ Removed `flask_cors`

## Server Startup

### Development (ASGI - Recommended)
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Production (ASGI)
```bash
gunicorn -k uvicorn.workers.UvicornWorker main:app
```

### Legacy WSGI (if needed temporarily)
```bash
# Install a2wsgi first: pip install a2wsgi
# Then modify main.py to wrap with ASGIMiddleware
```

## Troubleshooting

### Route Not Found (404 errors)
1. Verify OpenAPI spec paths match controller endpoints
2. Check resolver configuration
3. Ensure Connexion app is returned, not Flask app
4. Verify middleware doesn't interfere with routing

### CORS Issues
1. Check CORS middleware is added after `add_api()`
2. Verify allowed origins/methods/headers
3. Test with browser dev tools network tab

### Controller Errors
1. Ensure all `connexion.request` changed to `flask.request`
2. Check imports have `from flask import request`
3. Verify no remaining `import connexion` where not needed

## Testing
Run the test script:
```bash
python test_connexion3.py
```
