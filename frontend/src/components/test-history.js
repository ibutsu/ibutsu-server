import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@patternfly/react-core';
import { TableVariant, expandable } from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { resultToTestHistoryRow, filtersToAPIParams } from '../utilities';
import { WEEKS, RESULT_STATES } from '../constants';

import FilterTable from './filtertable';

import RunSummary from './runsummary';
import LastPassed from './last-passed';
import ResultView from './result';
import { useTableFilters } from './tableFilterHook';
import ActiveFilters from './active-filters';

// Month is considered to be 30 days, and there are 86400*1000 ms in a day
const millisecondsInMonth = 30 * 86400 * 1000;

const TestHistoryTable = ({ comparisonResults, testResult }) => {
  const [rows, setRows] = useState([]);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [isTimeRangeSelectOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setTimeRange] = useState('1 Week');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [historySummary, setHistorySummary] = useState();

  const filtersToHide = useRef(['project_id', 'result']); // prevent rerenders with ref

  const { activeFilters, setActiveFilters, updateFilters, onRemoveFilter } =
    useTableFilters({
      hideFilters: filtersToHide.current,
      blockRemove: ['result', 'test_id'],
    });

  // TODO ACTIVEFILTERS IS AN ARRAY NOW

  // useEffect(() => {
  //   if (testResult) {
  //     const envFilter = testResult?.env
  //       ? {
  //           field: 'env',
  //           operator: 'eq',
  //           value: testResult.env,
  //         }
  //       : {};

  //     // default to filter only from 1 weeks ago to the most test's start_time.

  //     const timeFilter = testResult?.start_time
  //       ? {
  //           field: 'start_time',
  //           operator: 'gt',
  //           value: new Date(
  //             new Date(testResult?.start_time).getTime() -
  //               WEEKS['1 Week'] * millisecondsInMonth,
  //           ).toISOString(),
  //         }
  //       : {};

  //     setActiveFilters([
  //       {
  //         field: 'result',
  //         operator: 'in',
  //         value: 'passed;skipped;failed;error;xpassed;xfailed',
  //       },
  //       {
  //         field: 'test_id',
  //         operator: 'eq',
  //         value: testResult?.test_id,
  //       },
  //       {
  //         field: 'component',
  //         operator: 'eq',
  //         value: testResult?.component,
  //       },
  //       timeFilter,
  //       envFilter,
  //       ...activeFilters.filter(
  //         (f) =>
  //           !['result', 'test_id', 'component', 'start_time', 'env'].includes(
  //             f.field,
  //           ),
  //       ),
  //     ]);
  //   }
  // }, [activeFilters, setActiveFilters, testResult]);

  // load individual result views on collapse to delay fetching artifacts
  const onCollapse = (_, rowIndex, isOpen) => {
    setRows(
      rows.map((row, index) => {
        if (index === rowIndex + 1) {
          return {
            ...row,
            cells: [
              {
                title: (
                  <ResultView
                    defaultTab="summary"
                    hideTestHistory={true}
                    testResult={rows[rowIndex].result}
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
      }),
    );
  };

  // fetch result data with active filters
  // useEffect(() => {
  //   const getResults = async () => {
  //     setIsError(false);
  //     setFetching(true);
  //     const apiParams = {
  //       page: page,
  //       pageSize: pageSize,
  //       estimate: true,
  //       filter: filtersToAPIParams(activeFilters),
  //     };
  //     console.log('historyEffect, fetching: ', apiParams);

  //     try {
  //       const response = await HttpClient.get(
  //         [Settings.serverUrl, 'result'],
  //         apiParams,
  //       );
  //       const data = await HttpClient.handleResponse(response);
  //       // setResults(data.results);
  //       setRows(
  //         data.results
  //           .map((result, index) =>
  //             resultToTestHistoryRow(result, index, updateFilters),
  //           )
  //           .flat(),
  //       );
  //       setPage(data.pagination.page);
  //       setPageSize(data.pagination.pageSize);
  //       setTotalItems(data.pagination.totalItems);
  //       setFetching(false);
  //     } catch (error) {
  //       console.error('Error fetching result data:', error);
  //       setRows([]);
  //       setIsError(false);
  //       setFetching(false);
  //     }
  //   };
  //   if (comparisonResults !== undefined) {
  //     setRows(
  //       comparisonResults
  //         .map((result, index) =>
  //           resultToTestHistoryRow(result, index, updateFilters),
  //         )
  //         .flat(),
  //     );
  //   } else {
  //     getResults();
  //   }
  // }, [
  //   page,
  //   pageSize,
  //   historySummary,
  //   comparisonResults,
  //   activeFilters,
  //   updateFilters,
  // ]);

  // Compose result summary from all results
  // useEffect(() => {
  //   if (activeFilters?.length) {
  //     const summary = {
  //       passes: 0,
  //       failures: 0,
  //       errors: 0,
  //       skips: 0,
  //       xfailures: 0,
  //       xpasses: 0,
  //     };

  //     const resultAggFetch = async () => {
  //       try {
  //         const apiParams = {
  //           group_field: 'result',
  //           additional_filters: filtersToAPIParams(activeFilters)
  //             .filter((filter) => {
  //               filter.field !== 'result'; // drop result filter to get all for summary
  //             })
  //             .join(),
  //         };
  //         const response = await HttpClient.get(
  //           [Settings.serverUrl, 'widget', 'result-aggregator'],
  //           apiParams,
  //         );
  //         const data = await HttpClient.handleResponse(response);
  //         data.forEach((item) => {
  //           summary[RESULT_STATES[item['_id']]] = item['count'];
  //         });
  //         setHistorySummary(summary);
  //       } catch (error) {
  //         console.error(error);
  //       }
  //     };

  //     resultAggFetch();
  //   }
  // }, [activeFilters]);

  // TODO rework for list of filters

  // const onFailuresCheck = useCallback(
  //   (checked) => {
  //     setActiveFilters({
  //       ...activeFilters,
  //       result: {
  //         ...activeFilters['result'], // keep the operator, replace val
  //         val:
  //           'failed;error' +
  //           (checked ? ';skipped;xfailed' : ';skipped;xfailed;xpassed;passed'),
  //       },
  //     });
  //     setOnlyFailures(checked);
  //   },
  //   [activeFilters, setActiveFilters],
  // );

  const onTimeRangeSelect = useCallback(
    (_, selection) => {
      if (testResult?.start_time) {
        const startTime = new Date(testResult?.start_time);
        const selectionCoefficient = WEEKS[selection];
        const timeRange = new Date(
          startTime.getTime() - selectionCoefficient * millisecondsInMonth,
        );
        setActiveFilters({
          ...activeFilters,
          ['start_time']: { op: 'gt', val: timeRange.toISOString() },
        });
        setTimeRangeOpen(false);
        setTimeRange(selection);
      }
    },
    [activeFilters, setActiveFilters, testResult?.start_time],
  );

  const onTimeRangeToggleClick = useCallback(() => {
    setTimeRangeOpen(!isTimeRangeSelectOpen);
  }, [isTimeRangeSelectOpen, setTimeRangeOpen]);

  const historyHeader = useMemo(() => {
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
            onChange={() => {}}
          />
        </TextContent>
      </FlexItem>
      <FlexItem spacer={{ sm: 'spacerSm' }}>
        <TextContent>Time range:</TextContent>
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
    </Flex>;
  }, [
    isTimeRangeSelectOpen,
    onTimeRangeSelect,
    onTimeRangeToggleClick,
    onlyFailures,
    selectedTimeRange,
  ]);

  const filterComponents = useMemo(() => {
    <Flex>
      <FlexItem>
        <Text key="summary" component="h4">
          Summary:&nbsp;
          {historySummary && <RunSummary summary={historySummary} />}
        </Text>
      </FlexItem>
      <FlexItem>
        <Text key="last-passed" component="h4">
          Last passed:&nbsp;
          <LastPassed filters={activeFilters} />
        </Text>
      </FlexItem>
      <FlexItem>
        <ActiveFilters
          key="active-filters"
          activeFilters={activeFilters}
          onRemoveFilter={onRemoveFilter}
          hideFilters={filtersToHide.current}
        />
      </FlexItem>
    </Flex>;
  }, [activeFilters, historySummary, onRemoveFilter]);

  const pagination = useMemo(
    () => ({
      pageSize: pageSize,
      page: page,
      totalItems: totalItems,
    }),
    [pageSize, page, totalItems],
  );

  return (
    <FilterTable
      fetching={fetching}
      columns={[
        {
          title: 'Result',
          cellFormatters: [expandable],
        },
        'Source',
        'Exception Name',
        'Duration',
        'Start Time',
      ]}
      rows={rows}
      pagination={pagination}
      isError={isError}
      onCollapse={onCollapse}
      onSetPage={(_, pageNumber) => setPage(pageNumber)}
      onSetPageSize={(_, pageSizeValue) => setPageSize(pageSizeValue)}
      canSelectAll={false}
      variant={TableVariant.compact}
      filters={filterComponents}
      headerChildren={historyHeader}
      className="pf-u-mt-lg"
    />
  );
};

TestHistoryTable.propTypes = {
  testResult: PropTypes.object,
  comparisonResults: PropTypes.array,
};

export default TestHistoryTable;
