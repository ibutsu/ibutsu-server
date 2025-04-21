import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Flex,
  FlexItem,
  TextContent,
  Title,
  Badge,
} from '@patternfly/react-core';
import { TableVariant, expandable } from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  toAPIFilter,
  getSpinnerRow,
  getIconForResult,
  buildBadge,
  generateId,
  toTitleCase,
  round,
} from '../utilities';
import {
  ClassificationDropdown,
  MultiClassificationDropdown,
} from './classification-dropdown';
import FilterTable from './filtertable';
import MetaFilter from './metafilter';
import ResultView from './result';
import { Link } from 'react-router-dom';

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

const resultToClassificationRow = (result, index, filterFunc) => {
  let resultIcon = getIconForResult(result.result);
  let markers = [];
  let exceptionBadge;

  if (filterFunc) {
    exceptionBadge = buildBadge(
      `exception_name-${result.id}`,
      result.metadata.exception_name,
      false,
      () =>
        filterFunc('metadata.exception_name', result.metadata.exception_name),
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
      <Badge key={`component-${result.id}`}>{result.metadata.component}</Badge>,
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

  return [
    // parent row
    {
      isOpen: false,
      result: result,
      cells: [
        {
          title: (
            <React.Fragment>
              <Link to={`../results/${result.id}#summary`} relative="Path">
                {result.test_id}
              </Link>{' '}
              {markers}
            </React.Fragment>
          ),
        },
        {
          title: (
            <span className={result.result}>
              {resultIcon} {toTitleCase(result.result)}
            </span>
          ),
        },
        { title: <React.Fragment>{exceptionBadge}</React.Fragment> },
        { title: <ClassificationDropdown testResult={result} /> },
        { title: round(result.duration) + 's' },
      ],
    },
    // child row (this is set in the onCollapse function for lazy-loading)
    {
      parent: 2 * index,
      cells: [{ title: <div /> }],
    },
  ];
};

const ClassifyFailuresTable = ({ filters, run_id }) => {
  const [rows, setRows] = useState([getSpinnerRow(5)]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    ...filters,
    result: { op: 'in', val: 'failed;error' },
    run_id: { op: 'eq', val: run_id },
  });

  // Fetch and set filteredResults on filter and pagination updates
  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);

      try {
        const response = await HttpClient.get([Settings.serverUrl, 'result'], {
          filter: toAPIFilter(appliedFilters),
          pageSize: pageSize,
          page: page,
        });
        const data = await HttpClient.handleResponse(response);
        setFilteredResults(data.results);
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setFilteredResults([]);
        setIsError(true);
      }
    };

    fetchData();
  }, [page, pageSize, appliedFilters]);

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

  const onTableRowSelect = (_, isSelected, rowId) => {
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
  };

  const onSkipCheck = (checked) => {
    setIncludeSkipped(checked);
    setAppliedFilters({
      ...appliedFilters,
      result: {
        ...appliedFilters.result,
        val: 'failed;error' + (checked ? ';skipped;xfailed' : ''),
      },
    });
  };

  // METAFILTER FUNCTIONS
  const updateFilters = useCallback(
    (_filterId, name, operator, value) => {
      let newFilters = { ...appliedFilters };
      if (value === null || value.length === 0) {
        delete newFilters[name];
      } else {
        newFilters[name] = { op: operator, val: value };
      }

      setAppliedFilters(newFilters);
      setPage(1);
    },
    [appliedFilters],
  );

  const setFilter = useCallback(
    (filterId, field, value) => {
      // maybe process values array to string format here instead of expecting caller to do it?
      // TODO when value is an object (params field?) .includes blows up
      let operator = value.includes(';') ? 'in' : 'eq';
      updateFilters(filterId, field, operator, value);
    },
    [updateFilters],
  );

  const removeFilter = (filterId, id) => {
    if (id !== 'result' && id !== 'run_id') {
      // Don't allow removal of error/failure filter
      updateFilters(filterId, id, null, null);
    }
  };

  const resultFilters = [
    <MetaFilter
      key="metafilter"
      runId={run_id}
      setFilter={setFilter}
      activeFilters={appliedFilters}
      onRemoveFilter={removeFilter}
      hideFilters={['run_id', 'project_id']}
      id={0}
    />,
  ];

  useEffect(() => {
    // set rows when filtered items update
    setRows(
      filteredResults.flatMap((result, index) =>
        resultToClassificationRow(result, index, setFilter),
      ),
    );
  }, [filteredResults, setFilter]);

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
                onChange={(_, checked) => onSkipCheck(checked)}
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
          columns={COLUMNS}
          rows={rows}
          pagination={{
            pageSize: pageSize,
            page: page,
            totalItems: totalItems,
          }}
          isEmpty={rows.length === 0}
          isError={isError}
          onCollapse={onCollapse}
          onSetPage={(_, change) => setPage(change)}
          onSetPageSize={(_, change) => setPageSize(change)}
          canSelectAll={true}
          onRowSelect={onTableRowSelect}
          variant={TableVariant.compact}
          filters={resultFilters}
        />
      </CardBody>
    </Card>
  );
};

ClassifyFailuresTable.propTypes = {
  filters: PropTypes.object,
  run_id: PropTypes.string,
};

export default ClassifyFailuresTable;
