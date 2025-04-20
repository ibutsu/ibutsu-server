import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Flex,
  FlexItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  TextContent,
  Text,
  Title
} from '@patternfly/react-core';
import {
  TableVariant,
  expandable
} from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildParams,
  toAPIFilter,
  getSpinnerRow,
  resultToTestHistoryRow,
} from '../utilities';

import FilterTable from './filtertable';

import RunSummary from './runsummary';
import LastPassed from './last-passed';
import ResultView from './result';

const COLUMNS = [
  {
    'title': 'Result',
    'cellFormatters': [expandable]
  },
  'Source',
  'Exception Name',
  'Duration',
  'Start Time'
];

const WEEKS = {
  '1 Week': 0.25,
  '2 Weeks': 0.5,
  '1 Month': 1.0,
  '2 Months': 2.0,
  '3 Months': 3.0,
  '5 Months': 5.0
};

const RESULT_STATES = {
  'passed': 'passes',
  'failed': 'failures',
  'error': 'errors',
  'skipped': 'skips',
  'xfailed': 'xfailures',
  'xpassed': 'xpasses'
};

// Month is considered to be 30 days, and there are 86400*1000 ms in a day
const millisecondsInMonth = 30 * 86400 * 1000;

const TestHistoryTable = (props) => {
  const {
    comparisonResults,
    filters,
    testResult
  } = props;

  const [rows, setRows] = useState([getSpinnerRow(5)]);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isEmpty, setIsEmpty] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isTimeRangeSelectOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setTimeRange] = useState('1 Week');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [historySummary, setHistorySummary] = useState();
  const [filtersState, setFiltersState] = useState({});

  useEffect(() => {
    const env_filter = {};
    if (testResult?.env) {
      env_filter['env'] = {
        op: 'eq',
        val: testResult.env
      };
    }
    const time_filter = {};
    if (testResult?.start_time) {
      // default to filter only from 1 weeks ago to the most test's start_time.
      time_filter['start_time'] = {
        op: 'gt',
        val: new Date(new Date(testResult?.start_time).getTime() - (WEEKS['1 Week'] * millisecondsInMonth)).toISOString()
      };
    }
    setFiltersState(
      {
        ...filters,
        'result': {
          op: 'in',
          val: 'passed;skipped;failed;error;xpassed;xfailed'
        },
        'test_id': {
          op: 'eq',
          val: testResult?.test_id
        },
        'component': {
          op: 'eq',
          val: testResult?.component
        },
        ...time_filter,
        ...env_filter
      }
    );

  }, [testResult, filters]);

  const onCollapse = (event, rowIndex, isOpen) => {
    // lazy-load the result view so we don't have to make a bunch of artifact requests
    // TODO with ResultView moving tab rendering and artifact fetching into ArtifactTab, this may not be necessary anymore
    setRows(rows.map((row, index) => {
      if (index === (rowIndex + 1)){
        return ({
          ...row,
          'cells': [{
            title: <ResultView defaultTab='summary' hideTestHistory={true} hideSummary={false} hideTestObject={false} testResult={rows[rowIndex].result}/>
          }]});
      } else if (index === rowIndex) {
        return({
          ...row,
          'isOpen': isOpen
        });
      } else {
        return(row);
      }
    }));
  };

  const updateFilters = useCallback((name, operator, value) => {
    const updatedfilters = {...filtersState};
    if ((value === null) || (value.length === 0)) {
      delete updatedfilters[name];
    }
    else {
      updatedfilters[name] = {'op': operator, 'val': value};
    }
    setFiltersState(updatedfilters);
    setPage(1);
  }, [filtersState]);

  const setFilter = useCallback((field, value) => {
    // maybe process values array to string format here instead of expecting caller to do it?
    const operator = (value.includes(';')) ? 'in' : 'eq';
    updateFilters(field, operator, value);
  }, [updateFilters]);

  useEffect(()=>{
    if (comparisonResults !== undefined) {
      // setResults(comparisonResultsState)
      setRows(comparisonResults.map((result, index) => resultToTestHistoryRow(result, index, setFilter)).flat());
    } else {
      setRows([getSpinnerRow(4)]);
      setIsEmpty(false);
      setIsError(false);
      const params = buildParams(filtersState);
      params['filter'] = toAPIFilter(filtersState);
      params['pageSize'] = pageSize;
      params['page'] = page;
      params['estimate'] = 'true';

      setRows([['Loading...', '', '', '', '']]);
      HttpClient.get([Settings.serverUrl, 'result'], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          // setResults(data.results);
          setRows(data.results.map((result, index) => resultToTestHistoryRow(result, index, setFilter)).flat());
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          // setTotalPages(data.pagination.totalPages)
          setTotalItems(data.pagination.totalItems);
          setIsEmpty(data.pagination.totalItems === 0);
        })
        .catch((error) => {
          console.error('Error fetching result data:', error);
          setRows([]);
          setIsEmpty(false);
          setIsError(false);
        });
    }
  }, [page, pageSize, historySummary, comparisonResults, setFilter, filtersState]);

  const removeFilter = (id) => {
    if ((id !== 'result') && (id !== 'test_id')) {   // Don't allow removal of error/failure filter
      updateFilters(id, null, null);
    }
  };


  useEffect(() => {
    // get the passed/failed/etc test summary
    if (JSON.stringify(filtersState) !== '{}') {
      const historyFilters = {...filtersState};
      // disregard result filter (we want all results)
      delete historyFilters['result'];
      const api_filter = toAPIFilter(historyFilters).join();

      const summary = {
        'passes': 0,
        'failures': 0,
        'errors': 0,
        'skips': 0,
        'xfailures': 0,
        'xpasses': 0
      };

      HttpClient.get(
        [Settings.serverUrl, 'widget', 'result-aggregator'],
        {
          group_field: 'result',
          additional_filters: api_filter,
        }
      )
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          data.forEach(item => {
            summary[RESULT_STATES[item['_id']]] = item['count'];
          });
          setHistorySummary(summary);
        });
    }
  }, [filtersState]);

  const onFailuresCheck = (checked) => {
    setFiltersState({
      ...filtersState,
      'result': {
        ...filtersState['result'],
        'val': ('failed;error') + ((checked) ? ';skipped;xfailed' : ';skipped;xfailed;xpassed;passed')
      }
    });
    setOnlyFailures(checked);
  };

  const onTimeRangeSelect  = (_, selection) => {
    if (testResult?.start_time) {
      const startTime = new Date(testResult?.start_time);
      const selectionCoefficient = WEEKS[selection];
      const timeRange = new Date(startTime.getTime() - (selectionCoefficient * millisecondsInMonth));
      setFiltersState({
        ...filtersState,
        ['start_time']: {op: 'gt', val: timeRange.toISOString()}
      });
      setTimeRangeOpen(false);
      setTimeRange(selection);
    }
  };
  const onTimeRangeToggleClick = () => {
    setTimeRangeOpen(!isTimeRangeSelectOpen);
  };

  return (
    <Card className="pf-u-mt-lg">
      <CardHeader>
        <Flex style={{ width: '100%' }}>
          <FlexItem grow={{ default: 'grow' }}>
            <TextContent>
              <Title headingLevel='h2'>
                Test History
              </Title>
            </TextContent>
          </FlexItem>
          <FlexItem>
            <TextContent>
              <Checkbox id="only-failures" label="Only show failures/errors" isChecked={onlyFailures} aria-label="only-failures-checkbox" onChange={(_, checked) => onFailuresCheck(checked)}/>
            </TextContent>
          </FlexItem>
          <FlexItem spacer={{ sm: 'spacerSm' }}>
            <TextContent>
              Time range:
            </TextContent>
          </FlexItem>
          <FlexItem>
            <Select
              id="single-select"
              isOpen={isTimeRangeSelectOpen}
              selected={selectedTimeRange}
              onSelect={onTimeRangeSelect}
              onOpenChange={(isTimeRangeSelectOpen) => setTimeRangeOpen(isTimeRangeSelectOpen)}
              toggle={toggleRef => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={onTimeRangeToggleClick}
                  isExpanded={isTimeRangeSelectOpen}
                >
                  {selectedTimeRange}
                </MenuToggle>
              )}
              shouldFocusToggleOnSelect
            >
              <SelectList>
                {Object.keys(WEEKS).map((key) => (
                  <SelectOption key={key} value={key}>
                    {key}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <FilterTable
          columns={COLUMNS}
          rows={rows}
          pagination={{
            pageSize: pageSize,
            page: page,
            totalItems: totalItems
          }}
          isEmpty={isEmpty}
          isError={isError}
          onCollapse={onCollapse}
          onSetPage={(_, pageNumber) => setPage(pageNumber)}
          onSetPageSize={(_, pageSizeValue) => setPageSize(pageSizeValue)}
          canSelectAll={false}
          variant={TableVariant.compact}
          activeFilters={filtersState}
          filters={[
            <Text key="summary" component="h4">
              Summary:&nbsp;
              {historySummary &&
              <RunSummary summary={historySummary}/>
              }
            </Text>,
            <Text key="last-passed" component="h4">Last passed:&nbsp;<LastPassed filters={filtersState}/></Text>,
          ]}
          onRemoveFilter={removeFilter}
          hideFilters={['project_id', 'result', 'test_id', 'component']}
        />
      </CardBody>
    </Card>
  );
};

TestHistoryTable.propTypes = {
  filters: PropTypes.object,
  testResult: PropTypes.object,
  comparisonResults: PropTypes.array
};

export default TestHistoryTable;
