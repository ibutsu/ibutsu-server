// Custom hook to manage widget filter functionality
import { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { filtersToAPIParams, apiParamsToFilters } from '../../utilities';
import { RESULT_FIELDS, RUN_FIELDS } from '../../constants';
import FilterProvider, { FilterContext } from '../contexts/filter-context';
import RunFilter from '../filtering/run-filter';
import ResultFilter from '../filtering/result-filter';
import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';

// Constants for widget classification
const RESULT_BASED_WIDGETS = [
  'result-summary',
  'result-aggregator',
  'importance-component',
];

/**
 * Custom hook for managing widget filter functionality
 * Consolidates common filter logic used in both EditWidgetModal and NewWidgetWizard
 */
export const useWidgetFilters = ({
  widgetType,
  widgetId,
  initialFilterString = '',
  componentLoaded = true, // Allow external control of when to fetch runs
}) => {
  const [filterContextRef, setFilterContextRef] = useState(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [runs, setRuns] = useState([]);

  // Determine widget characteristics
  const isResultBasedWidget = useMemo(() => {
    return RESULT_BASED_WIDGETS.includes(widgetId);
  }, [widgetId]);

  const hasFilterParam = useMemo(() => {
    return widgetType?.params?.some(
      (param) => param.name === 'additional_filters',
    );
  }, [widgetType]);

  // Parse existing filters from API string
  const initialFilters = useMemo(() => {
    if (!initialFilterString) return [];
    return apiParamsToFilters(initialFilterString);
  }, [initialFilterString]);

  // Get active filters for API conversion
  const getActiveFiltersAsAPIString = useCallback(() => {
    if (!hasFilterParam || !filterContextRef?.activeFilters?.length) {
      return '';
    }
    const filterStrings = filtersToAPIParams(filterContextRef.activeFilters);
    return filterStrings.join(',');
  }, [hasFilterParam, filterContextRef]);

  // Custom FilterProvider that captures the filter context
  const CustomFilterProvider = useCallback(
    ({ children, ...props }) => {
      const FilterContextCapture = ({ children }) => {
        const filterContext = useContext(FilterContext);

        useEffect(() => {
          if (filterContext) {
            setFilterContextRef(filterContext);
          }
        }, [filterContext]);

        return children;
      };

      return (
        <FilterProvider {...props} initialFilters={initialFilters}>
          <FilterContextCapture>{children}</FilterContextCapture>
        </FilterProvider>
      );
    },
    [initialFilters],
  );

  // Fetch runs for ResultFilter if needed
  useEffect(() => {
    if (componentLoaded && isResultBasedWidget) {
      const fetchRuns = async () => {
        try {
          const response = await HttpClient.get([Settings.serverUrl, 'run'], {
            pageSize: 100,
            estimate: true,
          });
          const data = await HttpClient.handleResponse(response);
          const runIds = data.runs.map((run) => run.id);
          setRuns(runIds);
        } catch (error) {
          console.error('Error fetching runs:', error);
        }
      };
      fetchRuns();
    }
  }, [componentLoaded, isResultBasedWidget]);

  // Reset filter context (for cleanup)
  const resetFilterContext = useCallback(() => {
    // Clear active filters if we have access to the filter context
    if (filterContextRef?.setActiveFilters) {
      // Reset to only project_id filter (if any)
      filterContextRef.setActiveFilters((prevFilters) =>
        prevFilters.filter((f) => f.field === 'project_id'),
      );
    }
    // Don't clear filterContextRef to preserve project_id filters
    // Only increment reset counter to force CustomFilterProvider re-initialization
    setResetCounter((prev) => prev + 1);
  }, [filterContextRef]);

  return {
    // State
    filterContextRef,
    resetCounter,
    runs,

    // Computed values
    isResultBasedWidget,
    hasFilterParam,
    initialFilters,

    // Functions
    getActiveFiltersAsAPIString,
    resetFilterContext,
    CustomFilterProvider,
  };
};

/**
 * Reusable FilterComponent that renders the appropriate filter based on widget type
 */
export const WidgetFilterComponent = ({
  isResultBasedWidget,
  runs,
  hideFilters = ['project_id'],
  CustomFilterProvider,
  widgetId,
  resetCounter = 0,
}) => {
  const FilterComponent = isResultBasedWidget ? ResultFilter : RunFilter;
  const fieldOptions = isResultBasedWidget ? RESULT_FIELDS : RUN_FIELDS;

  return (
    <FormGroup label="Filters" fieldId="widget-filters">
      <CustomFilterProvider
        key={`widget-filter-${widgetId}-${resetCounter}`}
        fieldOptions={fieldOptions}
        hideFilters={hideFilters}
      >
        <FilterComponent
          hideFilters={hideFilters}
          runs={isResultBasedWidget ? runs : undefined}
          maxHeight="300px"
        />
      </CustomFilterProvider>
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="default">
            Configure filters to limit the data shown in this widget
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
};

WidgetFilterComponent.propTypes = {
  isResultBasedWidget: PropTypes.bool.isRequired,
  runs: PropTypes.arrayOf(PropTypes.string),
  hideFilters: PropTypes.arrayOf(PropTypes.string),
  CustomFilterProvider: PropTypes.func.isRequired,
  widgetId: PropTypes.string.isRequired,
  resetCounter: PropTypes.number,
};
