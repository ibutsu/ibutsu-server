import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import PropTypes from 'prop-types';
import {
  Checkbox,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Content,
  CardHeader,
  CardBody,
  Label,
  Card,
  LabelGroup,
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  filtersToAPIParams,
  toTitleCase,
  exceptionToBadge,
} from '../utilities';
import { WEEKS, RESULT_STATES, ICON_RESULT_MAP } from '../constants';

import RunSummary from './runsummary';
import LastPassed from './last-passed';
import ResultView from './resultView';
import ActiveFilters from './filtering/active-filters';
import usePagination from './hooks/usePagination';
import FilterTable from './filtering/filtered-table-card';
import useTableFilters from './hooks/useTableFilters';

const HIDE = ['project_id', 'test_id'];
const BLOCK = ['result', 'component', 'start_time', 'env'];

const COLUMNS = [
  'Result',
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
  } = useTableFilters({
    blockRemove: BLOCK,
  });

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
  const [fetching, setFetching] = useState(true);

  const [isTimeRangeSelectOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1 Week');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [historySummary, setHistorySummary] = useState();
  const [rows, setRows] = useState([]);

  const resultToTestHistoryRow = useCallback((result, filterFunc) => {
    // Create expanded content for the ResultView
    const expandedContent = (
      <ResultView
        key="expanded-content"
        defaultTab="summary"
        hideTestHistory={true}
        testResult={result}
        skipHash={true}
      />
    );

    const rowData = {
      id: result.id,
      result: result,
      expandedContent: expandedContent,
      cells: [
        <Label
          key="result-icon"
          variant="filled"
          title={result.result}
          icon={ICON_RESULT_MAP[result.result]}
        >
          {toTitleCase(result.result)}
        </Label>,
        <span key="source" className={result.source}>
          {result.source}
        </span>,
        <React.Fragment key="exception">
          {exceptionToBadge(result?.metadata?.exception_name, filterFunc)}
        </React.Fragment>,
        Math.ceil(result.duration) + 's',
        new Date(result.start_time).toLocaleString(),
      ],
    };

    return rowData;
  }, []);

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
                WEEKS[selectedTimeRange] * millisecondsInMonth,
            ).toISOString(),
          }
        : {};

      setActiveFilters((prevFilters) => {
        // Build filters array, only including non-empty filter objects
        const newFilters = [
          {
            field: 'result',
            operator: 'in',
            value:
              'failed;error;manual' +
              (onlyFailures
                ? ';skipped;xfailed'
                : ';skipped;xfailed;xpassed;passed'),
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
          ...prevFilters.filter(
            (f) =>
              !['result', 'test_id', 'component', 'start_time', 'env'].includes(
                f.field,
              ),
          ),
        ];

        // Only add timeFilter and envFilter if they have a field property (not empty objects)
        if (timeFilter?.field) {
          newFilters.push(timeFilter);
        }
        if (envFilter?.field) {
          newFilters.push(envFilter);
        }

        return newFilters;
      });
    }
  }, [onlyFailures, setActiveFilters, testResult, selectedTimeRange]);

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
          data.results.map((result) =>
            resultToTestHistoryRow(result, updateFilters),
          ),
        );

        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(false);
      }
      setFetching(false);
    };

    if (comparisonResults !== undefined) {
      setRows([...comparisonResults]);
      setFetching(false);
    } else {
      const debouncer = setTimeout(() => {
        getResults();
      }, 50);
      return () => {
        clearTimeout(debouncer);
      };
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
    resultToTestHistoryRow,
  ]);

  // Compose result summary from all results
  useEffect(() => {
    const resultAggFetch = async (summary) => {
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
        data?.forEach((item) => {
          summary[RESULT_STATES[item['_id']]] = item['count'];
        });
        setHistorySummary(summary);
      } catch (error) {
        console.error(error);
      }
    };

    const summary = {
      passes: 0,
      failures: 0,
      errors: 0,
      skips: 0,
      xfailures: 0,
      xpasses: 0,
    };

    if (
      // only query summary when more than just the project_id filter is active
      !(
        Array.isArray(activeFilters) &&
        activeFilters.length === 1 &&
        activeFilters[0].field === 'project_id'
      )
    ) {
      const debouncer = setTimeout(() => {
        resultAggFetch(summary);
      }, 50);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [activeFilters]);

  // Handle checkbox for only failures
  const onFailuresCheck = useCallback((_, checked) => {
    setOnlyFailures(checked);
  }, []);

  // Handle time range select
  const onTimeRangeSelect = useCallback(
    (_, selection) => {
      if (Object.hasOwn(testResult, 'start_time')) {
        setTimeRangeOpen(false);
        setSelectedTimeRange(selection);
      }
    },
    [testResult],
  );

  // Handle time range toggle
  const onTimeRangeToggleClick = useCallback(() => {
    setTimeRangeOpen(!isTimeRangeSelectOpen);
  }, [isTimeRangeSelectOpen, setTimeRangeOpen]);

  // Render card header with only failures checkbox and time range select
  const historyHeader = useMemo(() => {
    return (
      <CardHeader>
        <Flex
          direction={{ default: 'row' }}
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
        >
          <Flex
            direction={{ default: 'column' }}
            alignItems={{ default: 'alignItemsLeft' }}
          >
            <FlexItem>
              <Checkbox
                id="only-failures"
                label={
                  <LabelGroup>
                    <Label>
                      <Content component="h4">
                        Failures and Errors Only:{' '}
                      </Content>
                    </Label>
                  </LabelGroup>
                }
                isChecked={onlyFailures}
                aria-label="only-failures-checkbox"
                onChange={onFailuresCheck}
                labelPosition="start"
                isLabelWrapped
              />
            </FlexItem>
            <FlexItem spacer={{ sm: 'spacerSm' }}>
              <LabelGroup>
                <Label>
                  <Content component="h4">Time Range</Content>
                </Label>
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
              </LabelGroup>
            </FlexItem>
          </Flex>
          <Flex direction={{ default: 'row' }}>
            <Card isCompact>
              <CardHeader>
                <Content component="h4">Summary</Content>
              </CardHeader>
              <CardBody>
                <RunSummary summary={historySummary} />
              </CardBody>
            </Card>
            <Card isCompact>
              <CardHeader>
                <Content component="h4">Last passed:</Content>
              </CardHeader>
              <CardBody>
                <LastPassed filters={activeFilters} />
              </CardBody>
            </Card>
          </Flex>
        </Flex>
      </CardHeader>
    );
  }, [
    activeFilters,
    historySummary,
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
              <ActiveFilters
                key="active-filters"
                activeFilters={activeFilters}
                onRemoveFilter={onRemoveFilter}
                hideFilters={HIDE}
                transferTarget="results"
              />
            </FlexItem>
          </Flex>
        </Flex>
      </CardBody>
    ),
    [activeFilters, onRemoveFilter],
  );

  return (
    <FilterTable
      expandable
      headerChildren={historyHeader}
      fetching={fetching}
      columns={COLUMNS}
      rows={rows}
      filters={filterComponents}
      pageSize={pageSize}
      page={page}
      totalItems={totalItems}
      isError={isError}
      onClearFilters={clearFilters}
      onSetPage={onSetPage}
      onSetPageSize={onSetPageSize}
      footerChildren={
        <Content className="disclaimer" component="h4">
          * Note: for performance reasons, the total number of items is an
          estimate. Apply filters on the Test Results page to get precise
          results.
        </Content>
      }
    />
  );
};

TestHistoryTable.propTypes = {
  testResult: PropTypes.object,
  comparisonResults: PropTypes.array,
};

export default TestHistoryTable;
