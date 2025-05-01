// TODO this component is incomplete
// It has been converted to functional, but aspects of the view aren't working in production and aren't fixed here
// MetaFilter removal isn't working right now
// The Apply Filters button needs connection to table rendering
// It would be great to better control the selectable fields in MetaFilter for this view as not all fields are relevant
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  Flex,
  FlexItem,
  TextContent,
  Checkbox,
  Button,
  Text,
} from '@patternfly/react-core';
import { TableVariant, expandable } from '@patternfly/react-table';

import FilterTable from '../components/filtering/filtered-table-card';
import MetaFilter from '../components/metafilter';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  toAPIFilter,
  getSpinnerRow,
  resultToComparisonRow,
} from '../utilities';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import ResultView from '../components/resultView';

const COLUMNS = [
  { title: 'Test', cellFormatters: [expandable] },
  'Run 1',
  'Run 2',
];
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

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

  const updateFilters = (filterId, name, operator, value) => {
    let newFilters = { ...filters };
    if (value === null || value.length === 0) {
      delete newFilters['run' + filterId][name];
    } else {
      newFilters['run' + filterId][name] = { op: operator, val: String(value) };
    }

    setFilters(newFilters);
    setPage(1);
  };

  const setFilter = (filterId, field, value) => {
    // maybe process values array to string format here instead of expecting caller to do it?
    updateFilters(filterId, field, value.includes(';') ? 'in' : 'eq', value);
  };

  // TODO use block with useTableFilters
  const removeFilter = (filterId, id) => {
    if (id !== 'result' && id !== 'run_id') {
      // Don't allow removal of error/failure filter
      updateFilters(filterId, id, null, null);
    }
  };

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
          console.dir(data.results);
          setResults(data.results);
          setPage(data.pagination.page.toString());
          setPageSize(data.pagination.pageSize.toString());
          setTotalItems(data.pagination.totalItems);
        })
        .catch((error) => {
          console.error('Error fetching result data:', error);
          setIsError(true);
        });
    }

    setIsLoading(false);
  }, [filters, primaryObject]);

  const onCollapse = (_, rowIndex, isOpen) => {
    // handle row expansion with ResultView
    if (isOpen) {
      let result = rows[rowIndex].result;
      let hideSummary = true;
      let hideTestObject = true;
      let defaultTab = 'test-history';
      if (result.result === 'skipped') {
        hideSummary = false;
        hideTestObject = false;
      }
      const updatedRows = rows.map((row, index) => {
        let newRow = {};
        if (index === rowIndex) {
          // expand the parent
          newRow = { ...row, isOpen: isOpen };
        } else if (index === rowIndex + 1) {
          // populate the expanded child with a ResultView in the title cell
          newRow = {
            ...row,
            cells: [
              {
                title: (
                  <ResultView
                    hideArtifact={true}
                    comparisonResults={result}
                    defaultTab={defaultTab}
                    hideTestHistory={false}
                    hideSummary={hideSummary}
                    hideTestObject={hideTestObject}
                    testResult={result[0]}
                  />
                ),
              },
            ],
          };
        } else {
          newRow = { ...row };
        }
        return newRow;
      });
      setRows(updatedRows);
    } else {
      // handle closing clicked rows
      setRows((prevRows) => {
        const updatedRows = [...prevRows];
        if (updatedRows[rowIndex]) {
          updatedRows[rowIndex] = { ...updatedRows[rowIndex], isOpen: isOpen };
        }
        return updatedRows;
      });
    }
  };

  // Remove all active filters and clear table
  const clearFilters = () => {
    setFilters(DEFAULT_FILTER);
    setPage(1);
    setTotalItems(0);
  };

  const resultFilters = [
    <Flex
      key="metafilters"
      direction={{ default: 'column' }}
      spaceItems={{ default: 'spaceItemsMd' }}
    >
      <FlexItem key="metafilter1">
        <TextContent style={{ fontWeight: 'bold' }}>Run 1:</TextContent>
        <MetaFilter
          setFilter={setFilter}
          customFilters={{ result: filters['result'] }}
          activeFilters={filters['run0']}
          onRemoveFilter={removeFilter}
          hideFilters={['project_id']}
          id={0}
        />
      </FlexItem>
      <FlexItem key="metafilter2">
        <TextContent style={{ fontWeight: 'bold' }}>Run 2:</TextContent>
        <MetaFilter
          setFilter={setFilter}
          customFilters={{ result: filters['result'] }}
          activeFilters={filters['run1']}
          onRemoveFilter={removeFilter}
          hideFilters={['project_id']}
          id={1}
        />
      </FlexItem>
    </Flex>,
  ];

  useEffect(() => {
    setRows(
      results.flatMap((result, index) => resultToComparisonRow(result, index)),
    );
  }, [results]);

  const compareHeader = useMemo(() => {
    return (
      <Flex style={{ width: '100%' }}>
        <FlexItem grow={{ default: 'grow' }}>
          <TextContent>
            <Text component="h2" className="pf-v5-c-title pf-m-xl">
              Select Test Run metadata to compare
            </Text>
          </TextContent>
        </FlexItem>
        <FlexItem>
          <TextContent>
            <Checkbox
              id="include-skips"
              label="Include skips, xfails"
              isChecked={includeSkipped}
              aria-label="include-skips-checkbox"
              onChange={(_, checked) => onSkipCheck(checked)}
            />
          </TextContent>
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
  }, [includeSkipped, isLoading, onSkipCheck]);

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
        onCollapse={onCollapse}
        onSetPage={(_, value) => setPage(value)}
        onSetPageSize={(_, newPageSize, newPage) => {
          setPageSize(newPageSize);
          setPage(newPage);
        }}
        canSelectAll={false}
        variant={TableVariant.compact}
        filters={resultFilters}
        headerChildren={compareHeader}
      />
    )
  );
};

CompareRunsView.propTypes = {
  // view: PropTypes.object
};

export default CompareRunsView;
