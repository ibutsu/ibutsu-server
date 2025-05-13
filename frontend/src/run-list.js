import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';

import {
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';

import { useSearchParams } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { getSpinnerRow, runToRow } from './utilities';

import FilterTable from './components/filtertable';

import { RUN_FIELDS } from './constants';
import { IbutsuContext } from './services/context';
import { useTableFilters } from './components/activeFilterHook';

const COLUMNS = ['Run', 'Duration', 'Summary', 'Started', ''];

const RunList = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const { primaryObject } = useContext(IbutsuContext);

  const [rows, setRows] = useState([getSpinnerRow(5)]);
  // use state for pagination because it's a controlled input
  const [page, setPage] = useState(searchParams.get('page') || 1);
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') || 20);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(true);

  const filtersToHide = useRef(['project_id']); // prevent rerenders with ref

  const {
    activeFilters,
    activeFilterComponents,
    updateFilters,
    applyFilter,
    activeFiltersToApiParams,
    filterComponents,
    clearFilters,
  } = useTableFilters({
    hideFilters: filtersToHide.current,
    fieldOptions: RUN_FIELDS,
  });

  // Fetch runs based on active filters
  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      const apiParams = {
        estimate: true,
        page: page,
        pageSize: pageSize,
      };

      apiParams['filter'] = activeFiltersToApiParams();
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

    fetchData();
  }, [pageSize, page, primaryObject, updateFilters, activeFiltersToApiParams]);

  // apparently this is better to do in an effect
  useEffect(() => {
    document.title = 'Test Runs | Ibutsu';
  }, []);

  const pagination = useMemo(
    () => ({
      pageSize: pageSize,
      page: page,
      totalItems: totalItems,
    }),
    [pageSize, page, totalItems],
  );

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Text className="title" component="h1">
            Test runs
          </Text>
        </TextContent>
      </PageSection>
      <PageSection>
        <FilterTable
          fetching={fetching}
          columns={COLUMNS}
          rows={rows}
          filters={filterComponents}
          activeFilters={activeFilters}
          activeFilterComponents={activeFilterComponents}
          pagination={pagination}
          isError={isError}
          onApplyFilter={applyFilter}
          onClearFilters={clearFilters}
          onSetPage={(_, value) => {
            setPage(value);
            setSearchParams((prevParams) => {
              prevParams.set('page', value);
              return prevParams;
            });
          }}
          onSetPageSize={(_, value, newPage) => {
            setPageSize(value);
            setPage(newPage);
            setSearchParams((prevParams) => {
              prevParams.set('pageSize', value);
              return prevParams;
            });
          }}
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

RunList.propTypes = {};

export default RunList;
