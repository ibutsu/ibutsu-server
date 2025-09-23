# Hatch Usage Guide for ibutsu-server Backend

This document explains how to use Hatch for development and testing of the ibutsu-server backend.

## Prerequisites

- Python 3.9+ installed
- Hatch installed (`pip install hatch`)

## Available Environments

### Default Environment
The default environment includes the basic dependencies and scripts for development:

```bash
# Create and activate the default environment
hatch shell

# Run tests
hatch run test

# Run tests with coverage
hatch run test-cov

# Generate coverage report
hatch run cov-report

# Generate HTML coverage report
hatch run cov-html

# Run linting
hatch run lint

# Run linting with diff output
hatch run lint-check
```

### Test Environment Matrix
The test environment supports multiple Python versions (3.9, 3.10, 3.11):

```bash
# Run tests on all Python versions
hatch run test:run

# Run tests with coverage on all Python versions
hatch run test:run-cov

# Run tests on specific Python version
hatch run test.py3.9:run
hatch run test.py3.10:run
hatch run test.py3.11:run
```

## Common Commands

### Running Tests
```bash
# Run all tests
hatch run test

# Run specific test file
hatch run test ibutsu_server/test/test_health_controller.py

# Run tests with specific options
hatch run test -x -v  # Stop on first failure, verbose output
```

### Development Workflow
```bash
# Enter development shell
hatch shell

# Run linting before committing
hatch run lint

# Run tests with coverage
hatch run test-cov
hatch run cov-report
```

### Environment Management
```bash
# Show available environments
hatch env show

# Remove all environments (clean slate)
hatch env prune

# Create specific environment
hatch env create test.py3.9
```

## Notes

- The configuration automatically uses `psycopg2-binary` to avoid compilation issues
- All test dependencies are automatically installed when using hatch environments
- The existing `test_env` virtual environment can still be used alongside hatch
- Hatch environments are isolated and don't interfere with your system Python
