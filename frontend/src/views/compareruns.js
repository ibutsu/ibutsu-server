// TODO this component is incomplete
// It has been converted to functional, but aspects of the view aren't working in production and aren't fixed here
// MetaFilter removal isn't working right now
// The Apply Filters button needs connection to table rendering
// It would be great to better control the selectable fields in MetaFilter for this view as not all fields are relevant
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  Flex,
  FlexItem,
  Content,
  Checkbox,
  Button,
} from '@patternfly/react-core';
import { TableVariant } from '@patternfly/react-table';

import FilterTable from '../components/filtering/filtered-table-card';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
<<<<<<< Updated upstream
import {
  toAPIFilter,
  getSpinnerRow,
  resultToComparisonRow,
} from '../utilities';
=======
import { toAPIFilter, toTitleCase } from '../utilities';
>>>>>>> Stashed changes
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import usePagination from '../components/hooks/usePagination';

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

  const context = useContext(IbutsuContext);
  const { primaryObject } = context;

  const [results, setResults] = useState([]);
  const [rows, setRows] = useState([getSpinnerRow(3)]);
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
          ...filters.result,
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
    // Check to see if filters have been set besides id and result
    let isNew = false;
    setIsError(false);
    setIsLoading(true);

    // not mutating filters state, looking if there is a filter name that's non-default
    Object.values(filters).map((filter) => {
      if (Object.keys(filter).every((prop) => prop !== 'result')) {
        isNew = true;
      }
    });

    if (isNew === true) {
      // Add project id to params
      const projectId = primaryObject ? primaryObject.id : '';
      let filtersWithProject = {
        ...filters,
        project_id: { op: 'in', val: projectId },
      };

      console.dir(filtersWithProject);

      // Retrieve results from database
      HttpClient.get([Settings.serverUrl, 'widget', 'compare-runs-view'], {
        filters: filtersWithProject.map((f) => toAPIFilter(f)),
      })
        .then((response) => HttpClient.handleResponse(response))
        .then((data) => {
          setResults(data.results);
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
        })
        .catch((error) => {
          console.error('Error fetching result data:', error);
          setIsError(true);
        });
    }

    setIsLoading(false);
  }, [filters, primaryObject, setPage, setPageSize, setTotalItems]);

  useEffect(() => {
    setRows(
      results.map((result, index) => resultToComparisonRow(result, index)),
    );
  }, [results]);

  const compareHeader = useMemo(() => {
    return (
      <Flex style={{ width: '100%' }}>
        <FlexItem grow={{ default: 'grow' }}>
          <Content>
            <Content component="h2">
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
            />
          </Content>
        </FlexItem>
        <FlexItem>
          <Button variant="primary">
            {isLoading ? 'Loading Results' : 'Apply Filters'}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button variant="secondary" onClick={clearFilters} isDanger>
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

CompareRunsView.propTypes = {
  // view: PropTypes.object
};

export default CompareRunsView;
