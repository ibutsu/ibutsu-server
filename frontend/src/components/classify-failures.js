import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Flex,
  FlexItem,
  TextContent,
  Title,
} from '@patternfly/react-core';
import { TableVariant, expandable } from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { resultToClassificationRow, filtersToAPIParams } from '../utilities';
import { MultiClassificationDropdown } from './classification-dropdown';
import FilterTable from './filtering/filtered-table-card';
import ResultView from './resultView';
import usePagination from './hooks/usePagination';
import { FilterContext } from './contexts/filterContext';
import ResultFilter from './filtering/result-filter';
import { useParams } from 'react-router-dom';

const HIDE = ['project_id', 'run_id'];

const COLUMNS = [
  {
    title: 'Test',
    cellFormatters: [expandable],
  },
  'Result',
  'Exception Name',
  'Classification',
  'Duration',
];

const ClassifyFailuresTable = () => {
  const { activeFilters, updateFilters, clearFilters } =
    useContext(FilterContext);

  const { run_id } = useParams();

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    setTotalItems,
    totalItems,
    onSetPage,
    onSetPageSize,
  } = usePagination({ setParams: false });

  const [rows, setRows] = useState();
  const [fetching, setFetching] = useState(false);
  const [filteredResults, setFilteredResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);
  const [isError, setIsError] = useState(false);
  const [includeSkipped, setIncludeSkipped] = useState(false);

  const apiFilters = useMemo(() => {
    // process activeFilters and ensure run_id and result filters are included
    const resultFilter = {
      field: 'result',
      operator: 'in',
      value: `failed;error${includeSkipped ? ';skipped;xfailed' : ''}`,
    };
    const runIdFilter = {
      field: 'run_id',
      operator: 'eq',
      value: run_id,
    };
    // Replace or inject run_id and result filters
    const newFilters = activeFilters.map((filter) => {
      if (filter.field === 'run_id') {
        return runIdFilter;
      }
      if (filter.field === 'result') {
        return resultFilter;
      }
      return filter;
    });
    if (!newFilters.map((filter) => filter.field).includes('run_id')) {
      newFilters.push(runIdFilter);
    }
    if (!newFilters.map((filter) => filter.field).includes('result')) {
      newFilters.push(resultFilter);
    }
    return newFilters;
  }, [activeFilters, includeSkipped, run_id]);

  // Fetch and set filteredResults on filter and pagination updates
  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      setFetching(true);
      const apiParams = {
        pageSize: pageSize,
        page: page,
        ...(apiFilters?.length
          ? { filter: filtersToAPIParams(apiFilters) }
          : {}),
      };
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'result'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);
        setFilteredResults(data.results);
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setFetching(false);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setFilteredResults([]);
        setIsError(true);
        setFetching(false);
      }
    };

    const debouncer = setTimeout(() => {
      fetchData();
    }, 100);
    return () => {
      clearTimeout(debouncer);
    };
  }, [
    page,
    pageSize,
    activeFilters,
    setPage,
    setPageSize,
    setTotalItems,
    apiFilters,
  ]);

  const onCollapse = (_, rowIndex, isOpen) => {
    // handle row click opening the child row with ResultView
    if (isOpen) {
      let { result } = rows[rowIndex];
      let hideSummary = true;
      let hideTestObject = true;
      let defaultTab = 'test-history';
      if (result.result === 'skipped') {
        hideSummary = false;
        hideTestObject = false;
        defaultTab = 'summary';
      }

      const updatedRows = rows.map((row, index) => {
        let newRow = {};
        // set isOpen on the parent row items
        if (index === rowIndex) {
          newRow = { ...row, isOpen: isOpen };
        } else if (index === rowIndex + 1) {
          // set the ResultView on the child rows
          newRow = {
            ...row,
            cells: [
              {
                title: (
                  <ResultView
                    defaultTab={defaultTab}
                    hideSummary={hideSummary}
                    hideTestObject={hideTestObject}
                    testResult={rows[rowIndex].result}
                    skipHash={true}
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
      // handle updating isOpen on the clicked row (closing)
      setRows((prevRows) => {
        const updatedRows = [...prevRows];
        if (updatedRows[rowIndex]) {
          updatedRows[rowIndex] = { ...updatedRows[rowIndex], isOpen: isOpen };
        }
        return updatedRows;
      });
    }
  };

  const onTableRowSelect = useCallback(
    (_, isSelected, rowId) => {
      // either set every row or single row selected state
      let mutatedRows = rows.map((oneRow, index) => {
        if (index === rowId || rowId === -1) {
          oneRow.selected = isSelected;
        }
        return oneRow;
      });
      setRows(mutatedRows);

      // filter to only pick parent rows
      let resultsToSelect = mutatedRows.filter(
        (oneRow) => oneRow.selected && oneRow.parent === undefined,
      );
      // map again to pull the result out of the row
      resultsToSelect = resultsToSelect.map((oneRow) => oneRow.result);
      setSelectedResults(resultsToSelect);
    },
    [rows],
  );

  const onSkipCheck = useCallback((_, checked) => {
    setIncludeSkipped(checked);
  }, []);

  useEffect(() => {
    // set rows when filtered items update
    setRows(
      filteredResults.flatMap((result, index) =>
        resultToClassificationRow(result, index, updateFilters),
      ),
    );
  }, [filteredResults, updateFilters]);

  const resultFilterMemo = useMemo(() => {
    return <ResultFilter runs={[run_id]} hideFilters={HIDE} />;
  }, [run_id]);

  return (
    // mt-lg == margin top large
    <Card className="pf-u-mt-lg">
      <CardHeader>
        <Flex style={{ width: '100%' }}>
          <FlexItem grow={{ default: 'grow' }}>
            <TextContent>
              <Title headingLevel="h2">Test Failures</Title>
            </TextContent>
          </FlexItem>
          <FlexItem>
            <TextContent>
              <Checkbox
                id="include-skips"
                label="Include skips, xfails"
                isChecked={includeSkipped}
                aria-label="include-skips-checkbox"
                onChange={onSkipCheck}
              />
            </TextContent>
          </FlexItem>
          <FlexItem>
            <MultiClassificationDropdown selectedResults={selectedResults} />
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <FilterTable
          fetching={fetching}
          columns={COLUMNS}
          rows={rows}
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
          onCollapse={onCollapse}
          onSetPage={onSetPage}
          onSetPageSize={onSetPageSize}
          canSelectAll={true}
          onRowSelect={onTableRowSelect}
          variant={TableVariant.compact}
          filters={resultFilterMemo}
          onClearFilters={clearFilters}
        />
      </CardBody>
    </Card>
  );
};

ClassifyFailuresTable.propTypes = {};

export default ClassifyFailuresTable;
