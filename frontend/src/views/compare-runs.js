// TODO this component is incomplete
// It has been converted to functional, but aspects of the view aren't working in production and aren't fixed here
// The Apply Filters button needs connection to table rendering
// It would be great to better control the selectable fields in the filter for this view as not all fields are relevant
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import {
  Flex,
  FlexItem,
  Content,
  Checkbox,
  Button,
} from '@patternfly/react-core';
import { TableVariant } from '@patternfly/react-table';

import FilterTable from '../components/filtering/filtered-table-card';
import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { toAPIFilter, resultToComparisonRow } from '../utilities';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import usePagination from '../components/hooks/use-pagination';

const COLUMNS = ['Test', 'Run 1', 'Run 2'];
const FEP = 'failed;error;passed';
const FEPSX = 'failed;error;passed;skipped;xfailed';

const DEFAULT_FILTER = {
  // one for each run
  // TODO flatten this here and expand when fetch is made since they're kept in sync?
  // TODO filters as array
  run0: {
    result: { operator: 'in', val: FEP },
  },
  run1: {
    result: { operator: 'in', val: FEP },
  },
};

const CompareRunsView = () => {
  // const {view} = props;

  const context = use(IbutsuContext);
  const { primaryObject } = context;

  const [results, setResults] = useState([]);
  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    onSetPageSize,
    setPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({});

  const [isError, setIsError] = useState(false);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTER);

  const onSkipCheck = useCallback(
    (checked) => {
      setIncludeSkipped(checked);

      // mutate to set the result value field
      setFilters({
        ...filters,
        result: {
          operator: 'in',
          val: checked ? FEPSX : FEP,
        },
      });
    },
    [filters],
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER);
    setPage(1);
  }, [setPage]);

  useEffect(() => {
    const hasNonDefaultFilters = Object.values(filters).some((filter) =>
      Object.keys(filter).every((prop) => prop !== 'result'),
    );

    if (!hasNonDefaultFilters) {
      return;
    }

    const fetchResults = async () => {
      setIsError(false);
      setIsLoading(true);
      try {
        const projectId = primaryObject ? primaryObject.id : '';
        const filtersWithProject = {
          ...filters,
          project_id: { operator: 'eq', val: projectId },
        };
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'compare-runs-view'],
          { filters: toAPIFilter(filtersWithProject) },
        );
        const data = await HttpClient.handleResponse(response);
        setResults(data.results);
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [filters, primaryObject, setPage, setPageSize, setTotalItems]);

  const rows = useMemo(
    () => results.map((result, index) => resultToComparisonRow(result, index)),
    [results],
  );

  const compareHeader = useMemo(() => {
    return (
      <Flex style={{ width: '100%' }}>
        <FlexItem grow={{ default: 'grow' }}>
          <Content>
            <Content component="h2" ouiaId="compare-runs-header-title">
              Select Test Run metadata to compare
            </Content>
          </Content>
        </FlexItem>
        <FlexItem>
          <Content>
            <Checkbox
              id="include-skips"
              label="Include skips, xfails"
              isChecked={includeSkipped}
              aria-label="include-skips-checkbox"
              onChange={(_, checked) => onSkipCheck(checked)}
              ouiaId="compare-runs-include-skips-checkbox"
            />
          </Content>
        </FlexItem>
        <FlexItem>
          <Button variant="primary" ouiaId="compare-runs-apply-filters-button">
            {isLoading ? 'Loading Results' : 'Apply Filters'}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            onClick={clearFilters}
            isDanger
            ouiaId="compare-runs-clear-filters-button"
          >
            Clear Filters
          </Button>
        </FlexItem>
      </Flex>
    );
  }, [clearFilters, includeSkipped, isLoading, onSkipCheck]);

  // Compare runs work only when project is selected
  // TODO Apply Filters button needs to trigger table render
  return (
    primaryObject && (
      <FilterTable
        columns={COLUMNS}
        rows={rows}
        pageSize={pageSize}
        page={page}
        totalItems={totalItems}
        isError={isError}
        onSetPage={onSetPage}
        onSetPageSize={onSetPageSize}
        variant={TableVariant.compact}
        headerChildren={compareHeader}
      />
    )
  );
};

export default CompareRunsView;
