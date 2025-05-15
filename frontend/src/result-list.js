import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from 'react';

import {
  Button,
  Chip,
  ChipGroup,
  PageSection,
  PageSectionVariants,
  MenuToggle,
  Text,
  TextContent,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  CardBody,
  Flex,
  FlexItem,
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { resultToRow, filtersToAPIParams } from './utilities';
import FilterTable from './components/filtertable';
import { RESULT_FIELDS } from './constants';
import { IbutsuContext } from './services/context';
import { useTableFilters } from './components/tableFilterHook';
import { useSearchParams } from 'react-router-dom';
import ResultFilter from './components/result-filter';
import ActiveFilters from './components/active-filters';

const ResultList = () => {
  const { primaryObject } = useContext(IbutsuContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
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
    filterMode,
    fieldSelection,
    updateFilters,
    resetFilters,
    clearFilters,
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
    onRemoveFilter,
  } = useTableFilters({
    hideFilters: filtersToHide.current,
    fieldOptions: RESULT_FIELDS,
    filterComponentType: 'result',
  });

  const onRunSelect = useCallback(
    (_, selection) => {
      if (operationMode !== 'multi') {
        setRunSelection([selection]);
        setRunInputValue(selection);
        setRunFilterValue('');
        setIsRunOpen(false);
      } else if (runSelection.includes(selection)) {
        setRunSelection([...runSelection].filter((item) => item !== selection));
      } else {
        setRunSelection([...runSelection, selection]);
      }
    },
    [operationMode, runSelection],
  );

  const onRunTextInputChange = useCallback((_, value) => {
    setRunInputValue(value);
    setRunFilterValue(value);
  }, []);

  const onRunClear = useCallback(() => {
    setRunSelection([]);
    setRunInputValue('');
    setRunFilterValue('');
  }, []);

  const onResultSelect = useCallback(
    (_, selection) => {
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
    },
    [operationMode, resultSelection],
  );

  const onResultClear = useCallback(() => {
    setResultSelection([]);
    setIsResultOpen(false);
  }, []);

  // TODO difference with hook function with runselection/resultselection vars
  const applyFilter = useCallback(() => {
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
  }, [
    textFilter,
    filterMode,
    operationMode,
    resultSelection,
    runSelection,
    inValues,
    boolSelection,
    updateFilters,
    fieldSelection,
    operationSelection,
    resetFilters,
  ]);

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
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(true);
      }
    };

    fetchData();
  }, [activeFilters, page, pageSize, primaryObject, updateFilters]);

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

  const resultToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsResultOpen(!isResultOpen)}
        isExpanded={isResultOpen}
        isFullWidth
        placeholder="Select a result"
        ref={toggleRef}
      >
        {resultSelection.length !== 0 ? resultSelection : 'Select a result'}
      </MenuToggle>
    ),
    [isResultOpen, resultSelection],
  );
  const resultMultiToggle = useCallback(
    (toggleRef) => (
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
    ),
    [isResultOpen, resultSelection, onResultSelect, onResultClear],
  );
  const runToggle = useCallback(
    (toggleRef) => (
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
    ),
    [isRunOpen, runInputValue, onRunTextInputChange, onRunClear],
  );
  const runMultiToggle = useCallback(
    (toggleRef) => (
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
    ),
    [
      isRunOpen,
      runInputValue,
      runSelection,
      onRunSelect,
      onRunClear,
      onRunTextInputChange,
    ],
  );

  // TODO work in with filterComponents from the hook
  const filterComponents = useMemo(() => {
    return (
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
            <ResultFilter
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
              setIsOperationOpen={setIsOperationOpen}
              setResultSelection={setResultSelection}
              setRunSelection={setRunSelection}
              isRunOpen={isRunOpen}
              runSelection={runSelection}
              onRunSelect={onRunSelect}
              runToggle={runToggle}
              runMultiToggle={runMultiToggle}
              isResultOpen={isResultOpen}
              resultSelection={resultSelection}
              onResultSelect={onResultSelect}
              resultToggle={resultToggle}
              resultMultiToggle={resultMultiToggle}
              runFilterValue={runFilterValue}
              setIsRunOpen={setIsRunOpen}
              filteredRuns={filteredRuns}
              setIsResultOpen={setIsResultOpen}
            />
            <FlexItem>
              <Button ouiaId="filter-table-apply-button" onClick={applyFilter}>
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
    );
  }, [
    activeFilters,
    applyFilter,
    boolSelection,
    boolToggle,
    fieldSelection,
    fieldToggle,
    filterMode,
    filteredFieldOptions,
    filteredRuns,
    isBoolOpen,
    isFieldOpen,
    isOperationOpen,
    isResultOpen,
    isRunOpen,
    onBoolSelect,
    onFieldSelect,
    onOperationSelect,
    onRemoveFilter,
    onResultSelect,
    onRunSelect,
    operationMode,
    operationSelection,
    operationToggle,
    operations,
    resultMultiToggle,
    resultSelection,
    resultToggle,
    runFilterValue,
    runMultiToggle,
    runSelection,
    runToggle,
    setInValues,
    setIsBoolOpen,
    setIsFieldOpen,
    setIsOperationOpen,
    setTextFilter,
    textFilter,
  ]);

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
          filters={filterComponents}
          activeFilters={activeFilters}
          pageSize={pageSize}
          page={page}
          totalItems={totalItems}
          isError={isError}
          onClearFilters={onClearFilters}
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
