import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Checkbox,
  Flex,
  FlexItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  TextContent,
  Text,
  Title,
  CardHeader,
  CardBody,
} from '@patternfly/react-core';
import { expandable } from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { resultToTestHistoryRow, filtersToAPIParams } from '../utilities';
import { WEEKS, RESULT_STATES } from '../constants';

import RunSummary from './runsummary';
import LastPassed from './last-passed';
import ResultView from './resultView';
import ActiveFilters from './filtering/active-filters';
import usePagination from './hooks/usePagination';
import FilterTable from './filtering/filtered-table-card';
import { FilterContext } from './contexts/filterContext';

const HIDE = ['project_id', 'test_id'];

const COLUMNS = [
  {
    title: 'Result',
    cellFormatters: [expandable],
  },
  'Source',
  'Exception Name',
  'Duration',
  'Start Time',
];

// Month is considered to be 30 days, and there are 86400*1000 ms in a day
const millisecondsInMonth = 30 * 86400 * 1000;

const TestHistoryTable = ({ comparisonResults, testResult }) => {
  const {
    activeFilters,
    updateFilters,
    clearFilters,
    setActiveFilters,
    onRemoveFilter,
  } = useContext(FilterContext);

  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    setPageSize,
    onSetPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({ setParams: false });

  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [isTimeRangeSelectOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setTimeRange] = useState('1 Week');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [historySummary, setHistorySummary] = useState();
  const [rows, setRows] = useState([]);

  // Set active filters for result, test_id, component, time, and env based on test result
  useEffect(() => {
    if (testResult) {
      const envFilter = testResult?.env
        ? {
            field: 'env',
            operator: 'eq',
            value: testResult.env,
          }
        : {};

      // default to filter only from 1 weeks ago to the most test's start_time.

      const timeFilter = testResult?.start_time
        ? {
            field: 'start_time',
            operator: 'gt',
            value: new Date(
              new Date(testResult?.start_time).getTime() -
                WEEKS['1 Week'] * millisecondsInMonth,
            ).toISOString(),
          }
        : {};

      setActiveFilters((prevFilters) => [
        {
          field: 'result',
          operator: 'in',
          value: 'passed;skipped;failed;error;xpassed;xfailed',
        },
        {
          field: 'test_id',
          operator: 'eq',
          value: testResult?.test_id,
        },
        {
          field: 'component',
          operator: 'eq',
          value: testResult?.component,
        },
        timeFilter,
        envFilter,
        ...prevFilters.filter(
          (f) =>
            !['result', 'test_id', 'component', 'start_time', 'env'].includes(
              f.field,
            ),
        ),
      ]);
    }
  }, [setActiveFilters, testResult]);

  // fetch result data with active filters
  useEffect(() => {
    const getResults = async () => {
      setIsError(false);
      const apiParams = {
        page: page,
        pageSize: pageSize,
        estimate: true,
        filter: filtersToAPIParams(activeFilters),
      };

      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'result'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);
        setRows(
          data.results
            .map((result, index) =>
              resultToTestHistoryRow(result, index, updateFilters),
            )
            .flat(),
        );

        setPage(data.pagination.page.toString());
        setPageSize(data.pagination.pageSize.toString());
        setTotalItems(data.pagination.totalItems);
        setFetching(false);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(false);
        setFetching(false);
      }
    };
    if (comparisonResults !== undefined) {
      setRows([...comparisonResults]);
    } else {
      setFetching(true);
      getResults();
    }
  }, [
    activeFilters,
    comparisonResults,
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalItems,
    updateFilters,
  ]);

  // Compose result summary from all results
  useEffect(() => {
    if (
      // only query summary when more than just the project_id filter is active
      !(
        Array.isArray(activeFilters) &&
        activeFilters.length === 1 &&
        activeFilters[0].field === 'project_id'
      )
    ) {
      const summary = {
        passes: 0,
        failures: 0,
        errors: 0,
        skips: 0,
        xfailures: 0,
        xpasses: 0,
      };

      const resultAggFetch = async () => {
        // BUG TODO: It looks like the backend is dropping/ignoring the env filter
        // ex: I have two results matching all other filters, but one has env=prod and the other has env=stage
        // and the result aggregator is returning a count of 2 instead of 1 when the env filter is in additional_filters
        try {
          const apiParams = {
            group_field: 'result',
            additional_filters: filtersToAPIParams(
              activeFilters.filter((filter) => {
                if (filter.field !== 'result') {
                  return filter;
                } // drop result filter to get all for summary
              }),
            ),
          };
          const response = await HttpClient.get(
            [Settings.serverUrl, 'widget', 'result-aggregator'],
            apiParams,
          );
          const data = await HttpClient.handleResponse(response);
          data.forEach((item) => {
            summary[RESULT_STATES[item['_id']]] = item['count'];
          });
          setHistorySummary(summary);
        } catch (error) {
          console.error(error);
        }
      };

      resultAggFetch();
    }
  }, [activeFilters]);

  // Handle checkbox for only failures
  const onFailuresCheck = useCallback(
    (_, checked) => {
      const newFilters = activeFilters.map((filter) => {
        if (filter.field === 'result') {
          return {
            ...filter,
            value:
              'failed;error' +
              (checked
                ? ';skipped;xfailed'
                : ';skipped;xfailed;xpassed;passed'),
          };
        }
        return filter;
      });
      setActiveFilters(newFilters);
      setOnlyFailures(checked);
    },
    [activeFilters, setActiveFilters],
  );

  // Handle time range select
  const onTimeRangeSelect = useCallback(
    (_, selection) => {
      if (testResult?.start_time) {
        const startTime = new Date(testResult?.start_time);
        const selectionCoefficient = WEEKS[selection];
        const timeRange = new Date(
          startTime.getTime() - selectionCoefficient * millisecondsInMonth,
        );
        setActiveFilters(
          activeFilters.map((filter) => {
            if (filter.field === 'start_time') {
              return {
                ...filter,
                operator: 'gt',
                value: timeRange.toISOString(),
              };
            } else {
              return filter;
            }
          }),
        );
        setTimeRangeOpen(false);
        setTimeRange(selection);
      }
    },
    [activeFilters, setActiveFilters, testResult?.start_time],
  );

  // Handle time range toggle
  const onTimeRangeToggleClick = useCallback(() => {
    setTimeRangeOpen(!isTimeRangeSelectOpen);
  }, [isTimeRangeSelectOpen, setTimeRangeOpen]);

  // Render card header with only failures checkbox and time range select
  const historyHeader = useMemo(() => {
    return (
      <CardHeader>
        <Flex style={{ width: '100%' }}>
          <FlexItem grow={{ default: 'grow' }}>
            <TextContent>
              <Title headingLevel="h2">Test History</Title>
            </TextContent>
          </FlexItem>
          <FlexItem>
            <TextContent>
              <Checkbox
                id="only-failures"
                label="Only show failures/errors"
                isChecked={onlyFailures}
                aria-label="only-failures-checkbox"
                onChange={onFailuresCheck}
              />
            </TextContent>
          </FlexItem>
          <FlexItem spacer={{ sm: 'spacerSm' }}>
            <TextContent>Time range prior to start_time:</TextContent>
          </FlexItem>
          <FlexItem>
            <Select
              id="single-select"
              isOpen={isTimeRangeSelectOpen}
              selected={selectedTimeRange}
              onSelect={onTimeRangeSelect}
              onOpenChange={(isTimeRangeSelectOpen) =>
                setTimeRangeOpen(isTimeRangeSelectOpen)
              }
              toggle={(toggleRef) => (
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
    );
  }, [
    isTimeRangeSelectOpen,
    onFailuresCheck,
    onTimeRangeSelect,
    onTimeRangeToggleClick,
    onlyFailures,
    selectedTimeRange,
  ]);

  // Render filter components with summary, last passed, and active filters
  const filterComponents = useMemo(
    () => (
      <CardBody key="history-filters">
        <Flex
          alignSelf={{ default: 'alignSelfFlexEnd' }}
          direction={{ default: 'column' }}
          align={{ default: 'alignRight' }}
        >
          <Flex>
            <FlexItem>
              <Text key="summary" component="h4">
                Summary:&nbsp;
                <RunSummary summary={historySummary} />
              </Text>
            </FlexItem>
            <FlexItem>
              <Text key="last-passed" component="h4">
                Last passed:&nbsp;
                <LastPassed filters={activeFilters} />
              </Text>
            </FlexItem>
          </Flex>
          <Flex>
            <FlexItem>
              <ActiveFilters
                key="active-filters"
                activeFilters={activeFilters}
                onRemoveFilter={onRemoveFilter}
                hideFilters={HIDE}
              />
            </FlexItem>
          </Flex>
        </Flex>
      </CardBody>
    ),
    [activeFilters, historySummary, onRemoveFilter],
  );

  // load individual result views on collapse to delay fetching artifacts
  const onCollapse = useCallback((_, rowIndex, isOpen) => {
    setRows((prevRows) => {
      return prevRows.map((row, index) => {
        if (index === rowIndex + 1) {
          return {
            ...row,
            cells: [
              {
                title: (
                  <ResultView
                    defaultTab="summary"
                    hideTestHistory={true}
                    testResult={prevRows[rowIndex].result}
                    skipHash={true}
                  />
                ),
              },
            ],
          };
        } else if (index === rowIndex) {
          return {
            ...row,
            isOpen: isOpen,
          };
        } else {
          return row;
        }
      });
    });
  }, []);

  return (
    <FilterTable
      headerChildren={historyHeader}
      onCollapse={onCollapse}
      fetching={fetching}
      columns={COLUMNS}
      rows={rows}
      filters={filterComponents}
      activeFilters={activeFilters}
      pageSize={pageSize}
      page={page}
      totalItems={totalItems}
      isError={isError}
      onClearFilters={clearFilters}
      onSetPage={onSetPage}
      onSetPageSize={onSetPageSize}
      footerChildren={
        <Text className="disclaimer" component="h4">
          * Note: for performance reasons, the total number of items is an
          estimate. Apply filters on the Test Results page to get precise
          results.
        </Text>
      }
    />
  );
};

TestHistoryTable.propTypes = {
  testResult: PropTypes.object,
  comparisonResults: PropTypes.array,
};

export default TestHistoryTable;
