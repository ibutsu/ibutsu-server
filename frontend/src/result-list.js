import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';

import {
  Button,
  Chip,
  ChipGroup,
  PageSection,
  PageSectionVariants,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Text,
  TextContent,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  TextInput,
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { getSpinnerRow, resultToRow } from './utilities';
import MultiValueInput from './components/multivalueinput';
import FilterTable from './components/filtertable';
import { RESULT_FIELDS } from './constants';
import { IbutsuContext } from './services/context';
import { useTableFilters } from './components/activeFilterHook';
import { useSearchParams } from 'react-router-dom';

const ResultList = () => {
  const { primaryObject } = useContext(IbutsuContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([getSpinnerRow(5)]);
  const [runs, setRuns] = useState([]);
  const [filteredRuns, setFilteredRuns] = useState([]);

  const [page, setPage] = useState(searchParams.get('page') || 1);
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') || 20);
  const [totalItems, setTotalItems] = useState(0);

  const [runSelection, setRunSelection] = useState([]);
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [runInputValue, setRunInputValue] = useState('');
  const [runFilterValue, setRunFilterValue] = useState('');

  const [resultSelection, setResultSelection] = useState([]);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const [isError, setIsError] = useState(false);

  const filtersToHide = useRef(['project_id']); // prevent rerenders with ref

  const {
    activeFilters,
    activeFilterComponents,
    filterMode,
    fieldSelection,
    updateFilters,
    resetFilters,
    activeFiltersToApiParams,
    clearFilters,
    onApplyReport,
    onOperationSelect,
    operationMode,
    onBoolSelect,
    onFieldSelect,
    isFieldOpen,
    setIsFieldOpen,
    operationSelection,
    isOperationOpen,
    textFilter,
    setTextFilter,
    boolSelection,
    isBoolOpen,
    inValues,
    setInValues,
    setIsOperationOpen,
    setIsBoolOpen,
    fieldToggle,
    operationToggle,
    boolToggle,
    filteredFieldOptions,
    operations,
  } = useTableFilters({
    hideFilters: filtersToHide.current,
    fieldOptions: RESULT_FIELDS,
  });

  const onRunSelect = (_, selection) => {
    if (operationMode !== 'multi') {
      setRunSelection(selection);
      setRunInputValue(selection);
      setRunFilterValue('');
      setIsRunOpen(false);
    } else if (runSelection.includes(selection)) {
      setRunSelection([...runSelection].filter((item) => item !== selection));
    } else {
      setRunSelection([...runSelection, selection]);
    }
  };

  const onRunTextInputChange = (_, value) => {
    setRunInputValue(value);
    setRunFilterValue(value);
  };

  const onRunClear = () => {
    setRunSelection();
    setRunInputValue('');
    setRunFilterValue('');
  };

  const onResultSelect = (_, selection) => {
    if (operationMode !== 'multi') {
      setResultSelection(selection);
      setIsResultOpen(false);
    } else if (resultSelection.includes(selection)) {
      setResultSelection(
        [...resultSelection].filter((item) => item !== selection),
      );
    } else {
      setResultSelection([...resultSelection, selection]);
    }
  };

  const onResultClear = () => {
    setResultSelection([]);
    setIsResultOpen(false);
  };

  // TODO difference with hook function with runselection/resultselection vars
  const applyFilter = () => {
    let value = textFilter.trim();
    if (filterMode === 'result' && operationMode !== 'bool') {
      value =
        operationMode === 'multi'
          ? resultSelection?.join(';')
          : resultSelection;
    } else if (filterMode === 'run' && operationMode !== 'bool') {
      value =
        operationMode === 'multi' ? runSelection?.join(';') : runSelection;
    } else if (operationMode === 'multi') {
      value = inValues.map((item) => item.trim()).join(';');
    } else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters({
      field: fieldSelection,
      operator: operationSelection,
      value: value,
      callback: () => {
        resetFilters();
        setRunInputValue('');
        setResultSelection([]);
        setRunSelection([]);
      },
    });
  };

  // TODO try and flatten result/run selection?
  const onClearFilters = () => {
    clearFilters();
    setResultSelection([]);
    setRunSelection([]);
  };

  // fetch result data
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
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(true);
      }
    };

    fetchData();
  }, [
    activeFilters,
    activeFiltersToApiParams,
    page,
    pageSize,
    primaryObject,
    updateFilters,
  ]);

  // fetch 500 runs with estimate on count
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const response = await HttpClient.get([Settings.serverUrl, 'run'], {
          pageSize: 500,
          estimate: true,
        });
        const data = await HttpClient.handleResponse(response);
        const runIds = data.runs.map((run) => run.id);
        setRuns(runIds);
        setFilteredRuns(runIds);
      } catch (error) {
        console.error('Error fetching runs:', error);
      }
    };

    fetchRuns();
  }, []);

  // filter run options based on input
  useEffect(() => {
    let newSelectOptionsRun = [...runs];
    if (runInputValue) {
      newSelectOptionsRun = runs.filter((menuItem) =>
        menuItem.toLowerCase().includes(runFilterValue.toLowerCase()),
      );
    }
    setFilteredRuns(newSelectOptionsRun);
  }, [runFilterValue, runInputValue, isRunOpen, runs]);

  useEffect(() => {
    document.title = 'Test Results | Ibutsu';
  }, []);

  const resultToggle = (toggleRef) => (
    <MenuToggle
      onClick={() => setIsResultOpen(!isResultOpen)}
      isExpanded={isResultOpen}
      isFullWidth
      placeholder="Select a result"
      ref={toggleRef}
    >
      {resultSelection.length !== 0 ? resultSelection : 'Select a result'}
    </MenuToggle>
  );
  const resultMultiToggle = (toggleRef) => (
    <MenuToggle
      variant="typeahead"
      onClick={() => setIsResultOpen(!isResultOpen)}
      isExpanded={isResultOpen}
      isFullWidth
      placeholder="Select a result"
      ref={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          onClick={() => setIsResultOpen(!isResultOpen)}
          isExpanded={isResultOpen}
          placeholder="Select 1 or multiple results"
        >
          <ChipGroup aria-label="Current selections">
            {resultSelection?.map((selection, index) => (
              <Chip
                key={index}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onResultSelect(ev, selection);
                }}
              >
                {selection}
              </Chip>
            ))}
          </ChipGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities>
          {!!resultSelection && (
            <Button
              variant="plain"
              onClick={() => {
                onResultClear();
              }}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const runToggle = (toggleRef) => (
    <MenuToggle
      variant="typeahead"
      onClick={() => setIsRunOpen(!isRunOpen)}
      isExpanded={isRunOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={runInputValue}
          onClick={() => setIsRunOpen(!isRunOpen)}
          onChange={onRunTextInputChange}
          autoComplete="off"
          placeholder="Select a run"
          role="combobox"
          isExpanded={isRunOpen}
        />
        <TextInputGroupUtilities>
          {!!runInputValue && (
            <Button
              variant="plain"
              onClick={() => {
                onRunClear();
              }}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const runMultiToggle = (toggleRef) => (
    <MenuToggle
      variant="typeahead"
      onClick={() => setIsRunOpen(!isRunOpen)}
      isExpanded={isRunOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={runInputValue}
          onClick={() => setIsRunOpen(!isRunOpen)}
          onChange={onRunTextInputChange}
          autoComplete="off"
          placeholder="Select 1 or multiple runs"
          role="combobox"
          isExpanded={isRunOpen}
        >
          <ChipGroup aria-label="Current selections">
            {runSelection?.map((selection, index) => (
              <Chip
                key={index}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onRunSelect(ev, selection);
                }}
              >
                {selection}
              </Chip>
            ))}
          </ChipGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities>
          {runSelection?.length > 0 && (
            <Button
              variant="plain"
              onClick={() => {
                onRunClear();
              }}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const filterSelects = [
    <Select
      id="typeahead-select"
      selected={fieldSelection}
      isOpen={isFieldOpen}
      onSelect={onFieldSelect}
      key="field"
      onOpenChange={() => setIsFieldOpen(false)}
      toggle={fieldToggle}
    >
      <SelectList id="select-typeahead-listbox">
        {filteredFieldOptions.map((option, index) => (
          <SelectOption key={index} value={option}>
            {option}
          </SelectOption>
        ))}
      </SelectList>
    </Select>,
    <Select
      id="single-select"
      isOpen={isOperationOpen}
      selected={operationSelection}
      onSelect={(_, value) => {
        onOperationSelect(_, value);
        setResultSelection([]);
        setRunSelection([]);
      }}
      onOpenChange={() => setIsOperationOpen(false)}
      key="operation"
      toggle={operationToggle}
    >
      <SelectList>
        {Object.keys(operations).map((option, index) => (
          <SelectOption key={index} value={option}>
            {option}
          </SelectOption>
        ))}
      </SelectList>
    </Select>,
    <React.Fragment key="value">
      {operationMode === 'bool' && (
        <Select
          id="single-select"
          isOpen={isBoolOpen}
          selected={boolSelection}
          onSelect={onBoolSelect}
          onOpenChange={() => setIsBoolOpen(false)}
          toggle={boolToggle}
        >
          <SelectList>
            {['True', 'False'].map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      )}
      {filterMode === 'text' && operationMode === 'single' && (
        <TextInput
          type="text"
          id="textSelection"
          placeholder="Type in value"
          value={textFilter}
          onChange={(_, newValue) => setTextFilter(newValue)}
          style={{ height: 'inherit' }}
        />
      )}
      {filterMode === 'text' && operationMode === 'multi' && (
        <MultiValueInput
          onValuesChange={(values) => setInValues(values)}
          style={{ height: 'inherit' }}
        />
      )}
      {filterMode === 'run' && operationMode !== 'bool' && (
        <Select
          id="typeahead-select"
          isOpen={isRunOpen}
          selected={runSelection}
          onSelect={onRunSelect}
          onOpenChange={() => setIsRunOpen(false)}
          toggle={operationMode === 'multi' ? runMultiToggle : runToggle}
        >
          <SelectList>
            {filteredRuns.length === 0 && (
              <SelectOption isDisabled={true}>
                {`No runs found for "${runFilterValue}"`}
              </SelectOption>
            )}
            {filteredRuns.map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      )}
      {filterMode === 'result' && operationMode !== 'bool' && (
        <Select
          id="single-select"
          isOpen={isResultOpen}
          selected={resultSelection}
          onSelect={onResultSelect}
          onOpenChange={() => setIsResultOpen(false)}
          toggle={operationMode === 'multi' ? resultMultiToggle : resultToggle}
        >
          <SelectList>
            {['passed', 'xpassed', 'failed', 'xfailed', 'skipped', 'error'].map(
              (option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ),
            )}
          </SelectList>
        </Select>
      )}
    </React.Fragment>,
  ];

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
            Test results
          </Text>
        </TextContent>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        <FilterTable
          columns={['Test', 'Result', 'Duration', 'Run', 'Started']}
          rows={rows}
          filters={filterSelects}
          activeFilters={activeFilters}
          activeFilterComponents={activeFilterComponents}
          pagination={pagination}
          isError={isError}
          onApplyFilter={applyFilter}
          onClearFilters={onClearFilters}
          onApplyReport={onApplyReport}
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

ResultList.propTypes = {};

export default ResultList;
