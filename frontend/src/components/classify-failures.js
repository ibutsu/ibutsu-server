import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@patternfly/react-core';

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
import { TableVariant } from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  filtersToAPIParams,
  getIconForResult,
  toTitleCase,
  round,
  buildBadge,
  generateId,
} from '../utilities';
import { MultiClassificationDropdown } from './classification-dropdown';
import { ClassificationDropdown } from './classification-dropdown';
import FilterTable from './filtering/filtered-table-card';
import ResultView from './resultView';
import usePagination from './hooks/usePagination';
import { FilterContext } from './contexts/filterContext';
import ResultFilter from './filtering/result-filter';
import { useParams } from 'react-router-dom';

const HIDE = ['project_id', 'run_id'];

const COLUMNS = [
  'Test',
  'Result',
  'Exception Name',
  'Classification',
  'Duration',
];

const ClassifyFailuresTable = () => {
  const { activeFilters, updateFilters, clearFilters } =
    useContext(FilterContext);

  const { run_id } = useParams();

  // Function to convert result to classification row format
  const resultToClassificationRow = useCallback((result, index, filterFunc) => {
    let resultIcon = getIconForResult(result.result);
    let markers = [];
    let exceptionBadge;

    if (filterFunc) {
      exceptionBadge = buildBadge(
        `exception_name-${result.id}`,
        result.metadata.exception_name,
        false,
        () =>
          filterFunc({
            field: 'metadata.exception_name',
            operation: 'eq',
            value: result.metadata.exception_name,
          }),
      );
    } else {
      exceptionBadge = buildBadge(
        `exception_name-${result.id}`,
        result.metadata.exception_name,
        false,
      );
    }

    if (result.metadata && result.metadata.component) {
      markers.push(
        <Badge key={`component-${result.id}`}>
          {result.metadata.component}
        </Badge>,
      );
    }
    if (result.metadata && result.metadata.markers) {
      for (const marker of result.metadata.markers) {
        // Don't add duplicate markers
        if (markers.filter((m) => m.key === marker.name).length === 0) {
          markers.push(
            <Badge isRead key={`${marker.name}-${generateId(5)}`}>
              {marker.name}
            </Badge>,
          );
        }
      }
    }

    // Create expanded content for the ResultView
    let hideSummary = true;
    let hideTestObject = true;

    const expandedContent = (
      <ResultView
        key="expanded-content"
        defaultTab="iqe.log"
        hideSummary={hideSummary}
        hideTestObject={hideTestObject}
        testResult={result}
        skipHash={true}
      />
    );

    return {
      id: result.id,
      result: result,
      expandedContent: expandedContent,
      cells: [
        <React.Fragment key="test">
          <Link to={`../results/${result.id}#summary`} relative="Path">
            {result.test_id}
          </Link>{' '}
          {markers}
        </React.Fragment>,
        <span key="result" className={result.result}>
          {resultIcon} {toTitleCase(result.result)}
        </span>,
        <React.Fragment key="exception">{exceptionBadge}</React.Fragment>,
        <ClassificationDropdown key="classification" testResult={result} />,
        round(result.duration) + 's',
      ],
    };
  }, []);

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
    }, 50);
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

  const onTableRowSelect = useCallback(
    (event, isSelected, rowId) => {
      if (!rows) {
        console.warn('No rows available for selection');
        return;
      }

      // either set every row or single row selected state
      let mutatedRows = rows.map((oneRow, index) => {
        if (index === rowId || rowId === -1) {
          return { ...oneRow, selected: isSelected };
        }
        return oneRow;
      });
      setRows(mutatedRows);

      // filter to only pick rows without a parent (main rows, not child expanded rows)
      let resultsToSelect = mutatedRows.filter((oneRow) => oneRow.selected);
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
    const newRows = filteredResults.map((result, index) =>
      resultToClassificationRow(result, index, updateFilters),
    );
    setRows(newRows);
  }, [filteredResults, updateFilters, resultToClassificationRow]);

  const resultFilterMemo = useMemo(() => {
    return <ResultFilter runs={[run_id]} hideFilters={HIDE} />;
  }, [run_id]);

  return (
    // mt-lg == margin top large
    <Card className="pf-v5-u-mt-lg">
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
          selectable
          expandable
          fetching={fetching}
          columns={COLUMNS}
          rows={rows}
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
          onSetPage={onSetPage}
          onSetPageSize={onSetPageSize}
          onRowSelectCallback={onTableRowSelect}
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
