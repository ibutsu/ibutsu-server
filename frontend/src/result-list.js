import React, { useState, useEffect, useContext, useMemo } from 'react';

import {
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { resultToRow, filtersToAPIParams } from './utilities';
import FilterTable from './components/filtering/filtered-table-card';
import { RUN_RESULTS_COLUMNS } from './constants';
import { IbutsuContext } from './components/contexts/ibutsuContext';
import usePagination from './components/hooks/usePagination';
import { FilterContext } from './components/contexts/filterContext.js';
import ResultFilter from './components/filtering/result-filter';

const HIDE = ['project_id'];

const ResultList = () => {
  const { primaryObject } = useContext(IbutsuContext);
  const { activeFilters, updateFilters, clearFilters } =
    useContext(FilterContext);

  const [rows, setRows] = useState([]);
  const [runs, setRuns] = useState([]);

  const [fetching, setFetching] = useState(true);

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

  const [isError, setIsError] = useState(false);

  // fetch result data
  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      setFetching(true);
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
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setIsError(false);
        setFetching(false);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(true);
        setFetching(false);
      }
    };

    const debouncer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(debouncer);
  }, [
    activeFilters,
    page,
    pageSize,
    primaryObject,
    setPage,
    setPageSize,
    setTotalItems,
    updateFilters,
  ]);

  // fetch 100 runs with estimate on count
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const response = await HttpClient.get([Settings.serverUrl, 'run'], {
          pageSize: 100,
          estimate: true,
        });
        const data = await HttpClient.handleResponse(response);
        const runIds = data.runs.map((run) => run.id);
        setRuns(runIds);
      } catch (error) {
        console.error('Error fetching runs:', error);
      }
    };

    fetchRuns();
  }, []);

  useEffect(() => {
    document.title = 'Test Results | Ibutsu';
  }, []);

  const resultFilterMemo = useMemo(() => {
    return <ResultFilter runs={runs} hideFilters={HIDE} />;
  }, [runs]);

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Text className="title" component="h1">
            Test results
          </Text>
        </TextContent>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        <FilterTable
          fetching={fetching}
          columns={RUN_RESULTS_COLUMNS}
          rows={rows}
          filters={resultFilterMemo}
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
              approximation. Use the API with &lsquo;estimate=false&rsquo; if
              you need an accurate count.
            </Text>
          }
        />
      </PageSection>
    </React.Fragment>
  );
};

ResultList.propTypes = {};

export default ResultList;
