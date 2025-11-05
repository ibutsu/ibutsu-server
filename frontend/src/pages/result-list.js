import { useState, useEffect, useContext, useMemo } from 'react';

import { PageSection, Content } from '@patternfly/react-core';

import { HttpClient } from '../utilities/http';
import { Settings } from './settings';
import {
  resultToRow,
  filtersToAPIParams,
  tableSortFunctions,
} from '../utilities';
import FilterTable from '../components/filtering/filtered-table-card';
import { RUN_RESULTS_COLUMNS } from '../constants';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import usePagination from '../components/hooks/use-pagination';
import { FilterContext } from '../components/contexts/filter-context';
import ResultFilter from '../components/filtering/result-filter';

const HIDE = ['project_id'];

// Combine common sort functions with component-specific ones
const sortFunctions = {
  result: (a, b, direction) => {
    // Extract result text from the Result cell Label title
    const getResultText = (resultCell) => {
      if (!resultCell || !resultCell.props || !resultCell.props.children)
        return '';
      const labelElement = resultCell.props.children.find(
        (child) => child && child.props && child.props.title,
      );
      return labelElement ? labelElement.props.title : '';
    };

    const aValue = getResultText(a.cells[1]);
    const bValue = getResultText(b.cells[1]);
    return direction === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  },
  // Override with ResultList-specific cell indices
  duration: (a, b, direction) =>
    tableSortFunctions.duration(
      a,
      b,
      direction,
      RUN_RESULTS_COLUMNS.indexOf('Duration'),
    ),
  started: (a, b, direction) =>
    tableSortFunctions.started(
      a,
      b,
      direction,
      RUN_RESULTS_COLUMNS.indexOf('Started'),
    ),
};

const ResultList = () => {
  const { primaryObject } = useContext(IbutsuContext);
  const { activeFilters, updateFilters, clearFilters } =
    useContext(FilterContext);

  const [rows, setRows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [sortedRows, setSortedRows] = useState([]);
  const [sortBy, setSortBy] = useState({});

  const [fetching, setFetching] = useState(true);
  const [isError, setIsError] = useState(false);

  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    setPageSize,
    onSetPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({});

  // Handle sorting
  const handleSort = (event, columnIndex, direction, columnName) => {
    setSortBy({ index: columnIndex, direction });

    if (sortFunctions[columnName]) {
      const sorted = [...rows].sort((a, b) =>
        sortFunctions[columnName](a, b, direction),
      );
      setSortedRows(sorted);
    }
  };

  // Use sorted rows if sorting is active, otherwise use original rows
  const displayRows = sortBy.index !== undefined ? sortedRows : rows;

  // fetch result data
  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      const apiParams = {
        estimate: true,
        page: page,
        pageSize: pageSize,
        filter: filtersToAPIParams(activeFilters),
      };
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'result'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);
        setRows(
          data.results.map((result) => resultToRow(result, updateFilters)),
        );
        setSortedRows(
          data.results.map((result) => resultToRow(result, updateFilters)),
        );
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setIsError(false);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(true);
      }
      setFetching(false);
    };

    const debouncer = setTimeout(() => {
      fetchData();
    }, 150);
    return () => clearTimeout(debouncer);
  }, [
    activeFilters,
    page,
    pageSize,
    primaryObject,
    updateFilters,
    setPage,
    setPageSize,
    setTotalItems,
  ]);

  // fetch 100 runs with estimate on count
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const apiParams = {
          pageSize: 100,
          estimate: true,
        };

        // Add project_id filter if primaryObject is available
        if (primaryObject?.id) {
          apiParams.filter = [`project_id=${primaryObject.id}`];
        }

        const response = await HttpClient.get([Settings.serverUrl, 'run'], apiParams);
        const data = await HttpClient.handleResponse(response);
        const runIds = data.runs.map((run) => run.id);
        setRuns(runIds);
      } catch (error) {
        console.error('Error fetching runs:', error);
      }
    };

    const debouncer = setTimeout(() => {
      fetchRuns();
    }, 100);
    return () => clearTimeout(debouncer);
  }, [primaryObject]);

  useEffect(() => {
    document.title = 'Test Results | Ibutsu';
  }, []);

  const resultFilterMemo = useMemo(() => {
    return <ResultFilter runs={runs} hideFilters={HIDE} />;
  }, [runs]);

  return (
    <>
      <PageSection hasBodyWrapper={false} id="page">
        <Content>
          <Content className="title" component="h1">
            Test results
          </Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false} className="pf-v6-u-pb-0">
        <FilterTable
          fetching={fetching}
          columns={RUN_RESULTS_COLUMNS}
          rows={displayRows}
          filters={resultFilterMemo}
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
          onClearFilters={clearFilters}
          onSetPage={onSetPage}
          onSetPageSize={onSetPageSize}
          sortBy={sortBy}
          onSort={handleSort}
          sortFunctions={sortFunctions}
          footerChildren={
            <Content className="disclaimer" component="h4">
              * Note: for performance reasons, the total number of items is an
              approximation. Use the API with &lsquo;estimate=false&rsquo; if
              you need an accurate count.
            </Content>
          }
        />
      </PageSection>
    </>
  );
};

ResultList.propTypes = {};

export default ResultList;
