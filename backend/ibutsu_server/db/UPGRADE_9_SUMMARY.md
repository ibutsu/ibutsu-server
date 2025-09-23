# Upgrade 7 Function - Widget Parameter Migration

## Overview

The expanded `upgrade_7` function performs comprehensive widget configuration parameter migration to ensure all widget configs match their validated parameter schemas defined in `WIDGET_TYPES`.

## Changes Made

### 1. **Comprehensive Parameter Migration**

The function now handles all widget types and performs the following migrations:

#### A. `filters` → `additional_filters` Migration
- **Affected widget types:** `compare-runs-view`, `filter-heatmap`, `jenkins-job-view`
- **Issue:** Legacy widgets used `filters` parameter instead of standardized `additional_filters`
- **Production impact:** Fixes widgets like `filter-heatmap` that were using incorrect parameter names

#### B. `filter` → `additional_filters` Migration
- **Affected widget types:** `jenkins-job-view`
- **Issue:** Some widgets used singular `filter` instead of `additional_filters`
- **Production impact:** Ensures consistency across all filter-based widgets

#### C. `jenkins_job_name` → `job_name` Migration
- **Affected widget types:** `jenkins-heatmap`
- **Issue:** Legacy parameter name that should be standardized to `job_name`
- **Production impact:** Handles any remaining legacy jenkins widgets

#### D. Deprecated `chart_type` Removal from `run-aggregator`
- **Affected widget types:** `run-aggregator`
- **Issue:** Based on TODO comment in constants.py (lines 179-187), `chart_type` should be removed and all widgets forced to use "bar" chart type
- **Production impact:** Removes deprecated parameter from multiple production widgets

#### E. Invalid Parameter Cleanup
- **Affected widget types:** All widget types
- **Issue:** Removes any parameters that don't match the widget type's schema
- **Production impact:** Ensures all widgets only have valid parameters

### 2. **Enhanced Logging and Monitoring**

#### Migration Statistics Tracking
- Tracks counts for each type of migration performed
- Provides detailed logging of all changes made
- Logs warnings for invalid parameters removed

#### Detailed Change Logging
- Logs before/after parameter states for each updated widget
- Provides debug-level logging for individual parameter changes
- Includes summary statistics at completion

### 3. **Production Data Impact Analysis**

Based on the provided production data (262 widgets), the migration will:

#### Expected Changes:
- **`filter-heatmap` widgets:** Convert `filters` to `additional_filters`
  - Example: Widget `75a7aac1-7ebf-4587-9d7e-dec11a6e9fc6` with `"filters": "component=sources,env=clowder_smoke"`

- **`run-aggregator` widgets:** Remove deprecated `chart_type` parameter
  - Example: Widget `a4672e29-f75b-4b41-bc3b-3f7ec18304ee` with `"chart_type": "bar"`
  - Example: Widget `5f44b97c-3dc6-44e5-845f-9df802868b23` with `"chart_type": "donut"`

- **Parameter validation:** Remove any invalid parameters not in widget schemas

#### Widgets That Will Remain Unchanged:
- Widgets already using correct parameter names
- `result-aggregator` widgets with `chart_type` (this is valid for this widget type)
- Widgets with all parameters matching their schema

## Implementation Details

### Function Signature
```python
def upgrade_7(session):
    """Version 7 upgrade

    This upgrade migrates existing widget configurations to use validated
    parameter names that match the widget type specifications.
    """
```

### Key Features
1. **Comprehensive Coverage:** Processes all widget configs, not just specific types
2. **Safe Migration:** Creates backup of original parameters before changes
3. **Detailed Logging:** Tracks all changes with statistics and detailed logs
4. **Schema Validation:** Validates all parameters against `WIDGET_TYPES` definitions
5. **Backward Compatibility:** Handles all known legacy parameter names

### Error Handling
- Gracefully handles widgets with missing or null parameters
- Logs warnings for unknown widget types
- Continues processing even if individual widgets have issues
- Provides comprehensive error reporting

## Testing

The function has been validated against production data samples and correctly:
- Migrates `filters` to `additional_filters` for `filter-heatmap` widgets
- Removes deprecated `chart_type` from `run-aggregator` widgets
- Preserves valid `chart_type` for `result-aggregator` widgets
- Maintains all other valid parameters unchanged

## Deployment Considerations

1. **Backup Recommended:** Create database backup before running migration
2. **Logging Level:** Set appropriate logging level to capture migration details
3. **Monitoring:** Monitor migration statistics for expected change counts
4. **Validation:** Verify widget functionality after migration completes

## Expected Migration Statistics

Based on production data analysis:
- **Total widgets:** 262
- **Expected updates:** ~20-30 widgets (estimated)
- **Primary changes:** `filters` → `additional_filters`, `chart_type` removal
- **No data loss:** All valid parameters preserved, only invalid/deprecated ones removed
