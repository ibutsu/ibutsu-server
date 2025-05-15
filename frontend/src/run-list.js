import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';

import {
  Button,
  CardBody,
  Flex,
  FlexItem,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';

import { useSearchParams } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { runToRow, filtersToAPIParams } from './utilities';

import FilterTable from './components/filtertable';

import { RUN_FIELDS } from './constants';
import { IbutsuContext } from './services/context';
import { useTableFilters } from './components/tableFilterHook';
import RunFilter from './components/run-filter';
import ActiveFilters from './components/active-filters';

const COLUMNS = ['Run', 'Duration', 'Summary', 'Started', ''];

const RunList = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const { primaryObject } = useContext(IbutsuContext);

  const [rows, setRows] = useState([]);
  // use state for pagination because it's a controlled input
  const [page, setPage] = useState(searchParams.get('page') || 1);
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') || 20);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(true);

  const filtersToHide = useRef(['project_id']); // prevent rerenders with ref

  const {
    activeFilters,
    updateFilters,
    applyFilter,
    clearFilters,
    fieldSelection,
    isFieldOpen,
    onFieldSelect,
    fieldToggle,
    filteredFieldOptions,
    isOperationOpen,
    operationSelection,
    onOperationSelect,
    operationToggle,
    operations,
    operationMode,
    isBoolOpen,
    boolSelection,
    onBoolSelect,
    boolToggle,
    filterMode,
    textFilter,
    setInValues,
    setTextFilter,
    setIsFieldOpen,
    setIsBoolOpen,
    onRemoveFilter,
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

    fetchData();
  }, [pageSize, page, primaryObject, updateFilters, activeFilters]);

  // apparently this is better to do in an effect
  useEffect(() => {
    document.title = 'Test Runs | Ibutsu';
  }, []);

  const filterComponents = useMemo(
    () => (
      <React.Fragment>
        <CardBody key="filters">
          <Flex
            alignSelf={{ default: 'alignSelfFlexEnd' }}
            direction={{ default: 'column' }}
            align={{ default: 'alignRight' }}
          >
            <Flex
              grow={{ default: 'grow' }}
              spaceItems={{ default: 'spaceItemsXs' }}
            >
              <RunFilter
                fieldSelection={fieldSelection}
                isFieldOpen={isFieldOpen}
                onFieldSelect={onFieldSelect}
                fieldToggle={fieldToggle}
                filteredFieldOptions={filteredFieldOptions}
                isOperationOpen={isOperationOpen}
                operationSelection={operationSelection}
                onOperationSelect={onOperationSelect}
                operationToggle={operationToggle}
                operations={operations}
                operationMode={operationMode}
                isBoolOpen={isBoolOpen}
                boolSelection={boolSelection}
                onBoolSelect={onBoolSelect}
                boolToggle={boolToggle}
                filterMode={filterMode}
                textFilter={textFilter}
                setInValues={setInValues}
                setTextFilter={setTextFilter}
                setIsBoolOpen={setIsBoolOpen}
                setIsFieldOpen={setIsFieldOpen}
              />
              <FlexItem>
                <Button
                  ouiaId="filter-table-apply-button"
                  onClick={applyFilter}
                >
                  Apply Filter
                </Button>
              </FlexItem>
            </Flex>
            <Flex>
              <ActiveFilters
                activeFilters={activeFilters}
                onRemoveFilter={onRemoveFilter}
                hideFilters={filtersToHide.current}
              />
            </Flex>
          </Flex>
        </CardBody>
      </React.Fragment>
    ),
    [
      fieldSelection,
      isFieldOpen,
      onFieldSelect,
      fieldToggle,
      filteredFieldOptions,
      isOperationOpen,
      operationSelection,
      onOperationSelect,
      operationToggle,
      operations,
      operationMode,
      isBoolOpen,
      boolSelection,
      onBoolSelect,
      boolToggle,
      filterMode,
      textFilter,
      setInValues,
      setTextFilter,
      setIsBoolOpen,
      setIsFieldOpen,
      applyFilter,
      activeFilters,
      onRemoveFilter,
    ],
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
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
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
