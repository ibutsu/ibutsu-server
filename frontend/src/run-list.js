import React, { useState, useEffect, useContext, useMemo } from 'react';

import { PageSection, Content } from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { runToRow, filtersToAPIParams } from './utilities';

import FilterTable from './components/filtering/filtered-table-card';

import { IbutsuContext } from './components/contexts/ibutsuContext';
import RunFilter from './components/filtering/run-filter';
import usePagination from './components/hooks/usePagination';
import { FilterContext } from './components/contexts/filterContext.js';

const COLUMNS = ['Run', 'Duration', 'Summary', 'Started', ''];
const HIDE = ['project_id'];

const RunList = () => {
  const { primaryObject } = useContext(IbutsuContext);
  const { activeFilters, updateFilters, clearFilters } =
    useContext(FilterContext);

  const [rows, setRows] = useState([]);
  // use state for pagination because it's a controlled input
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

  const [fetching, setFetching] = useState(true);
  const [isError, setIsError] = useState(false);

  // Fetch runs based on active filters
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
          [Settings.serverUrl, 'run'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);
        setRows(data.runs.map((run) => runToRow(run, updateFilters)));
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setIsError(false);
      } catch (error) {
        console.error('Error fetching run data:', error);
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
    pageSize,
    page,
    primaryObject,
    updateFilters,
    activeFilters,
    setPage,
    setPageSize,
    setTotalItems,
  ]);

  // apparently this is better to do in an effect
  useEffect(() => {
    document.title = 'Test Runs | Ibutsu';
  }, []);

  const runFilterMemo = useMemo(() => {
    return <RunFilter hideFilters={HIDE} />;
  }, []);

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false} id="page">
        <Content>
          <Content className="title" component="h1">
            Test runs
          </Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <FilterTable
          fetching={fetching}
          columns={COLUMNS}
          rows={rows}
          filters={runFilterMemo}
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
              approximation. Use the API with &lsquo;estimate=false&rsquo; if
              you need an accurate count.
            </Content>
          }
        />
      </PageSection>
    </React.Fragment>
  );
};

RunList.propTypes = {};

export default RunList;
