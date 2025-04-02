import React, { useState, useEffect, useContext, useCallback } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
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
  TextInput
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  resultToRow
} from './utilities';
import MultiValueInput from './components/multivalueinput';
import FilterTable from './components/filtertable';
import { OPERATIONS, RESULT_FIELDS } from './constants';
import { IbutsuContext } from './services/context';
import { useNavigate } from 'react-router-dom';

const COLUMNS = ['Test', 'Run', 'Result', 'Duration', 'Started'];

const ResultList = () => {
  const navigate = useNavigate();

  const context = useContext(IbutsuContext);
  const {primaryObject} = context;

  const [rows, setRows] = useState([getSpinnerRow(5)]);
  const [runs, setRuns] = useState([]);
  const [filteredRuns, setFilteredRuns] = useState([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [filters, setFilters] = useState({});

  const [fieldSelection, setFieldSelection] = useState();
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const [filteredfieldOptions, setFilteredfieldOptions] = useState(RESULT_FIELDS);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState('');

  const [operationSelection, setOperationSelection] = useState('eq');
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const [textFilter, setTextFilter] = useState('');
  const [runSelection, setRunSelection] = useState([]);
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [runInputValue, setRunInputValue] = useState('');
  const [runFilterValue, setRunFilterValue] = useState('');

  const [resultSelection, setResultSelection] = useState([]);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const [boolSelection, setBoolSelection] = useState(false);
  const [isBoolOpen, setIsBoolOpen] = useState(false);

  const [isError, setIsError] = useState(false);

  const [inValues, setInValues] = useState([]);


  const onFieldSelect = (_, selection) => {
    if (selection === `Create "${fieldFilterValue}"`) {
      setFilteredfieldOptions([...filteredfieldOptions, fieldFilterValue]);
      setFieldSelection(fieldFilterValue);
      setFieldInputValue(fieldFilterValue);
    } else {
      setFieldSelection(selection);
      setFieldInputValue(selection);
    }

    setIsFieldOpen(false);
    setOperationSelection('eq');
  };

  const onFieldTextInputChange = (_, value) => {
    setFieldInputValue(value);
    setFieldFilterValue(value);
  };

  const onFieldClear = () => {
    setFieldSelection();
    setFieldInputValue('');
    setFieldFilterValue('');
  };

  const onOperationSelect = (event, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
    setResultSelection([]);
    setRunSelection([]);
    setBoolSelection(false);
  };

  const onRunSelect = (_, selection) => {
    const operationMode = getOperationMode(operationSelection);
    if (operationMode !== 'multi') {
      setRunSelection(selection);
      setRunInputValue(selection);
      setRunFilterValue('');
      setIsRunOpen(false);
    } else if (runSelection.includes(selection)) {
      setRunSelection([...runSelection].filter(item => item !== selection));
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

  const onBoolSelect = (_, selection) => {
    setBoolSelection(selection);
    setIsBoolOpen(false);
  };

  const onBoolClear = () => {
    setBoolSelection(false);
    setIsBoolOpen(false);
  };

  const onResultSelect = (_, selection) => {
    const operationMode = getOperationMode(operationSelection);
    if (operationMode !== 'multi') {
      setResultSelection(selection);
      setIsResultOpen(false);
    } else if (resultSelection.includes(selection)) {
      setResultSelection([...resultSelection].filter(item => item !== selection));
    } else {
      setResultSelection([...resultSelection, selection]);
    }
  };

  const onResultClear = () => {
    setResultSelection([]);
    setIsResultOpen(false);
  };

  const applyFilter = () => {
    const filterMode = getFilterMode(fieldSelection);
    const operationMode = getOperationMode(operationSelection);
    let value = textFilter.trim();
    if (filterMode === 'result' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? resultSelection?.join(';') : resultSelection;
    } else if (filterMode === 'run' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? runSelection?.join(';') : runSelection;
    } else if (operationMode === 'multi') {
      value = inValues.map(item => item.trim()).join(';');
    } else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters(fieldSelection, operationSelection, value, () => {
      setFieldSelection();
      setFieldInputValue('');
      setFieldFilterValue('');
      setRunInputValue('');
      setOperationSelection('eq');
      setTextFilter('');
      setResultSelection([]);
      setRunSelection([]);
      setBoolSelection(false);
      setInValues([]);
    });
  };

  const applyReport = () => {
    navigate('/project/' + primaryObject.id + '/reports?' + buildParams(filters).join('&'));
  };

  const updateFilters = useCallback((name, operator, value, callback) => {
    let newFilters = { ...filters };
    if (!value) {
      delete newFilters[name];
    } else {
      newFilters[name] = { 'op': operator, 'val': value };
    }
    setFilters(newFilters);
    setPage(1);
    callback();
  }, [filters]);

  const setFilter = useCallback((field, value) => {
    updateFilters(field, 'eq', value, () => {
      setFieldSelection();
      setOperationSelection('eq');
      setTextFilter('');
      setResultSelection([]);
      setRunSelection([]);
      setBoolSelection(false);
      setInValues([]);
    });
  }, [updateFilters]);

  const clearFilters = () => {
    setFilters({});
    setPage(1);
    setPageSize(20);
    setFieldSelection();
    setOperationSelection('eq');
    setTextFilter('');
    setResultSelection([]);
    setRunSelection([]);
    setBoolSelection(false);
    setInValues([]);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsError(false);
      setRows([getSpinnerRow(5)]);
      let apiParams = { filter: [] };
      let newFilters = { ...filters };
      if (primaryObject) {
        newFilters['project_id'] = { 'val': primaryObject.id, 'op': 'eq' };
      } else if (Object.prototype.hasOwnProperty.call(newFilters, 'project_id')) {
        delete newFilters['project_id'];
      }
      apiParams['estimate'] = true;
      apiParams['pageSize'] = pageSize;
      apiParams['page'] = page;
      for (let key in newFilters) {
        if (Object.prototype.hasOwnProperty.call(newFilters, key) && !!newFilters[key]) {
          const val = newFilters[key]['val'];
          const op = OPERATIONS[newFilters[key]['op']];
          apiParams.filter.push(key + op + val);
        }
      }
      try {
        const response = await HttpClient.get([Settings.serverUrl, 'result'], apiParams);
        const data = await HttpClient.handleResponse(response);
        setRows(data.results.map((result) => resultToRow(result, setFilter)));
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
  }, [filters, page, pageSize, primaryObject, setFilter]);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const response = await HttpClient.get([Settings.serverUrl, 'run'], { pageSize: 500, estimate: true });
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

  useEffect(() => {
    let newSelectOptionsField = RESULT_FIELDS;
    if (fieldInputValue) {
      newSelectOptionsField = RESULT_FIELDS.filter(menuItem =>
        menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase())
      );
      if (newSelectOptionsField.length !== 1 && !newSelectOptionsField.includes(fieldFilterValue)) {
        newSelectOptionsField.push(`Create "${fieldFilterValue}"`);
      }
    }
    setFilteredfieldOptions(newSelectOptionsField);
  }, [fieldFilterValue, fieldInputValue, isFieldOpen]);

  useEffect(() => {
    let newSelectOptionsRun = [...runs];
    if (runInputValue) {
      newSelectOptionsRun = runs.filter(menuItem =>
        menuItem.toLowerCase().includes(runFilterValue.toLowerCase())
      );
    }
    setFilteredRuns(newSelectOptionsRun);
  }, [runFilterValue, runInputValue, isRunOpen, runs]);

  useEffect(() => { document.title = 'Test Results | Ibutsu'; }, []);

  const filterMode = getFilterMode(fieldSelection);
  const operationMode = getOperationMode(operationSelection);
  const operations = getOperationsFromField(fieldSelection);

  const fieldToggle = toggleRef => (
    <MenuToggle
      variant="typeahead"
      aria-label="Typeahead creatable menu toggle"
      onClick={() => setIsFieldOpen(!isFieldOpen)}
      isExpanded={isFieldOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={fieldInputValue}
          onClick={() => setIsFieldOpen(!isFieldOpen)}
          onChange={onFieldTextInputChange}
          id="create-typeahead-select-input"
          autoComplete="off"
          placeholder="Select a field"
          role="combobox"
          isExpanded={isFieldOpen}
          aria-controls="select-create-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!fieldInputValue && (
            <Button
              variant="plain"
              onClick={() => {onFieldClear();}}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const operationToggle = toggleRef => (
    <MenuToggle
      onClick={() => setIsOperationOpen(!isOperationOpen)}
      isExpanded={isOperationOpen}
      isFullWidth
      ref={toggleRef}
    >
      {operationSelection}
    </MenuToggle>
  );
  const boolToggle = toggleRef => (
    <MenuToggle
      onClick={() => setIsBoolOpen(!isBoolOpen)}
      isExpanded={isBoolOpen}
      isFullWidth
      ref={toggleRef}
      style={{maxHeight: '36px'}}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={boolSelection.toString()}
          onClick={() => setIsBoolOpen(!isBoolOpen)}
          autoComplete="off"
          placeholder="Select True/False"
          role="combobox"
          isExpanded={isBoolOpen}
        />
        <TextInputGroupUtilities>
          {!!boolSelection && (
            <Button variant="plain" onClick={() => {
              onBoolClear();
            }} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const resultToggle = toggleRef => (
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
  const resultMultiToggle = toggleRef => (
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
                onClick={ev => {
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
              onClick={() => {onResultClear();}}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const runToggle = toggleRef => (
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
            <Button variant="plain" onClick={() => {
              onRunClear();
            }} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );
  const runMultiToggle = toggleRef => (
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
                onClick={ev => {
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
            <Button variant="plain" onClick={() => {
              onRunClear();
            }} aria-label="Clear input value">
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
      <SelectList  id="select-typeahead-listbox">
        {filteredfieldOptions.map((option, index) => (
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
      onSelect={onOperationSelect}
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
      {(operationMode === 'bool') &&
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
      }
      {(filterMode === 'text' && operationMode === 'single') &&
        <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter} onChange={(_, newValue) => setTextFilter(newValue)} style={{height: 'inherit'}}/>
      }
      {(filterMode === 'text' && operationMode === 'multi') &&
        <MultiValueInput onValuesChange={(values) => setInValues(values)} style={{height: 'inherit'}}/>
      }
      {(filterMode === 'run' && operationMode !== 'bool') &&
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
      }
      {(filterMode === 'result' && operationMode !== 'bool') &&
        <Select
          id="single-select"
          isOpen={isResultOpen}
          selected={resultSelection}
          onSelect={onResultSelect}
          onOpenChange={() => setIsResultOpen(false)}
          toggle={operationMode === 'multi' ? resultMultiToggle : resultToggle}
        >
          <SelectList>
            {['passed', 'xpassed', 'failed', 'xfailed', 'skipped', 'error'].map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>

        </Select>
      }
    </React.Fragment>
  ];

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Text className="title" component="h1">Test results</Text>
        </TextContent>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        <Card>
          <CardBody className="pf-u-p-0">
            <FilterTable
              columns={COLUMNS}
              rows={rows}
              filters={filterSelects}
              activeFilters={filters}
              pagination={{
                pageSize: pageSize,
                page: page,
                totalItems: totalItems
              }}
              isEmpty={rows.length === 0}
              isError={isError}
              onApplyFilter={applyFilter}
              onRemoveFilter={(id) => updateFilters(id, null, null, () => {}) }
              onClearFilters={clearFilters}
              onApplyReport={applyReport}
              onSetPage={(_, value) => setPage(value)}
              onSetPageSize={(_, value) => setPageSize(value)}
              hideFilters={['project_id']}
            />
          </CardBody>
          <CardFooter>
            <Text className="disclaimer" component="h4">
              * Note: for performance reasons, the total number of items is an approximation.
              Use the API with &lsquo;estimate=false&rsquo; if you need an accurate count.
            </Text>
          </CardFooter>
        </Card>
      </PageSection>
    </React.Fragment>
  );
};

ResultList.propTypes = {};

export default ResultList;
