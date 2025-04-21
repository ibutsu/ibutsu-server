import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from 'react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  MenuToggle,
  PageSection,
  PageSectionVariants,
  Select,
  SelectList,
  SelectOption,
  Text,
  TextContent,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { ChevronRightIcon, TimesIcon } from '@patternfly/react-icons';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildBadge,
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  round,
} from './utilities';

import FilterTable from './components/filtertable';

import MultiValueInput from './components/multivalueinput';
import RunSummary from './components/runsummary';
import { OPERATIONS, RUN_FIELDS } from './constants';
import { IbutsuContext } from './services/context';

const runToRow = (run, filterFunc) => {
  let badges = [];
  let created = 0;
  let componentBadge;
  if (run.start_time) {
    created = new Date(run.start_time);
  } else {
    created = new Date(run.created);
  }

  if (filterFunc) {
    if (run.component) {
      componentBadge = buildBadge('component', run.component, false, () =>
        filterFunc('component', run.component),
      );
    }
  } else {
    componentBadge = buildBadge('component', run.component, false);
  }
  badges.push(componentBadge);

  if (run.env) {
    let envBadge;
    if (filterFunc) {
      envBadge = buildBadge(run.env, run.env, false, () =>
        filterFunc('env', run.env),
      );
    } else {
      envBadge = buildBadge(run.env, run.env, false);
    }
    badges.push(envBadge);
  }
  return {
    cells: [
      {
        title: (
          <React.Fragment>
            <Link to={`${run.id}#summary`}>{run.id}</Link> {badges}
          </React.Fragment>
        ),
      },
      { title: round(run.duration) + 's' },
      { title: <RunSummary summary={run.summary} /> },
      { title: created.toLocaleString() },
      {
        title: (
          <Link to={`../results?run_id=${run.id}`} relative="Path">
            See results <ChevronRightIcon />
          </Link>
        ),
      },
    ],
  };
};

const COLUMNS = ['Run', 'Duration', 'Summary', 'Started', ''];

const RunList = () => {
  const navigate = useNavigate();
  const params = useParams();

  const { primaryObject } = useContext(IbutsuContext);

  const [rows, setRows] = useState([getSpinnerRow(5)]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [filters, setFilters] = useState({});

  const [fieldSelection, setFieldSelection] = useState(null);
  const [filteredFieldOptions, setFilteredFieldOptions] = useState(RUN_FIELDS);
  const [fieldOptions] = useState(RUN_FIELDS);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState('');
  const [isFieldOpen, setIsFieldOpen] = useState(false);

  const [operationSelection, setOperationSelection] = useState('eq');
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const [textFilter, setTextFilter] = useState('');

  const [isError, setIsError] = useState(false);
  const [inValues, setInValues] = useState([]);
  const [boolSelection, setBoolSelection] = useState(null);
  const [isBoolOpen, setIsBoolOpen] = useState(false);

  const updateFilters = useCallback((name, operator, value, callback) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (!value) {
        delete newFilters[name];
      } else {
        newFilters[name] = { op: operator, val: value };
      }
      return newFilters;
    });
    setPage(1);
    callback();
  }, []);

  const applyFilter = useCallback(() => {
    const field = fieldSelection;
    const operator = operationSelection;
    const operationMode = getOperationMode(operator);
    let value = textFilter.trim();
    if (operationMode === 'multi') {
      value = inValues.map((item) => item.trim()).join(';');
    } else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters(field, operator, value, () => {
      setFieldSelection(null);
      setFieldInputValue('');
      setFieldFilterValue('');
      setOperationSelection('eq');
      setTextFilter('');
      setInValues([]);
      setBoolSelection(null);
    });
  }, [
    fieldSelection,
    operationSelection,
    textFilter,
    updateFilters,
    inValues,
    boolSelection,
  ]);

  const setFilter = useCallback(
    (field, value) => {
      updateFilters(field, 'eq', value, () => {
        setFieldSelection(null);
        setOperationSelection('eq');
        setTextFilter('');
        setBoolSelection(null);
        setInValues([]);
      });
    },
    [updateFilters],
  );

  const removeFilter = useCallback(
    (id) => {
      updateFilters(id, null, null, () => {});
    },
    [updateFilters],
  );

  useEffect(() => {
    setIsError(false);
    const apiParams = { filter: [] };
    const apiFilters = { ...filters };
    if (primaryObject) {
      apiFilters['project_id'] = { val: primaryObject.id, op: 'eq' };
    } else if (Object.prototype.hasOwnProperty.call(apiFilters, 'project_id')) {
      delete apiFilters['project_id'];
    }
    apiParams['estimate'] = true;
    apiParams['pageSize'] = pageSize;
    apiParams['page'] = page;
    for (let key in apiFilters) {
      if (
        Object.prototype.hasOwnProperty.call(apiFilters, key) &&
        !!apiFilters[key]
      ) {
        const val = apiFilters[key]['val'];
        const op = OPERATIONS[apiFilters[key]['op']];
        apiParams.filter.push(key + op + val);
      }
    }
    HttpClient.get([Settings.serverUrl, 'run'], apiParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setRows(data.runs.map((run) => runToRow(run, setFilter)));
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      })
      .catch((error) => {
        console.error('Error fetching run data:', error);
        setRows([]);
        setIsError(true);
      });
  }, [pageSize, page, primaryObject, setFilter, filters, boolSelection]);

  const onFieldSelect = useCallback(
    (_, selection) => {
      if (selection === `Create "${fieldFilterValue}"`) {
        setFilteredFieldOptions((prev) => [...prev, fieldFilterValue]);
        setFieldSelection(fieldFilterValue);
        setFieldInputValue(fieldFilterValue);
        setOperationSelection('eq');
      } else {
        setFieldSelection(selection);
        setFieldInputValue(selection);
      }

      setIsFieldOpen(false);
      setOperationSelection('eq');
    },
    [fieldFilterValue],
  );

  const onFieldTextInputChange = useCallback((_, value) => {
    setFieldInputValue(value);
    setFieldFilterValue(value);
  }, []);

  const onFieldClear = useCallback(() => {
    setFieldSelection(null);
    setFieldFilterValue('');
    setFieldInputValue('');
  }, []);

  const onOperationSelect = useCallback((event, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
  }, []);

  const onBoolSelect = useCallback((event, selection) => {
    setBoolSelection(selection);
    setIsBoolOpen(false);
  }, []);

  const onBoolClear = useCallback(() => {
    setBoolSelection(null);
    setIsBoolOpen(false);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
    setPageSize(20);
    setFieldSelection(null);
    setOperationSelection('eq');
    setTextFilter('');
    setInValues([]);
    setBoolSelection(null);
  }, []);

  useEffect(() => {
    let newSelectOptionsField = fieldOptions;
    if (fieldInputValue) {
      newSelectOptionsField = fieldOptions.filter((menuItem) =>
        menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase()),
      );
      if (
        newSelectOptionsField.length !== 1 &&
        !newSelectOptionsField.includes(fieldFilterValue)
      ) {
        newSelectOptionsField.push(`Create "${fieldFilterValue}"`);
      }
    }
    setFilteredFieldOptions(newSelectOptionsField);
  }, [fieldFilterValue, fieldInputValue, fieldOptions, isFieldOpen]);

  useEffect(() => {
    document.title = 'Test Runs | Ibutsu';
  }, []);

  const filterMode = getFilterMode(fieldSelection);
  const operationMode = getOperationMode(operationSelection);
  const operations = getOperationsFromField(fieldSelection);

  const fieldToggle = useCallback(
    (toggleRef) => (
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
                onClick={onFieldClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [fieldInputValue, isFieldOpen, onFieldClear, onFieldTextInputChange],
  );

  const operationToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsOperationOpen(!isOperationOpen)}
        isExpanded={isOperationOpen}
        isFullWidth
        ref={toggleRef}
      >
        {operationSelection}
      </MenuToggle>
    ),
    [isOperationOpen, operationSelection],
  );

  const boolToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsBoolOpen(!isBoolOpen)}
        isExpanded={isBoolOpen}
        isFullWidth
        ref={toggleRef}
        style={{ maxHeight: '36px' }}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={boolSelection}
            onClick={() => setIsBoolOpen(!isBoolOpen)}
            autoComplete="off"
            placeholder="Select True/False"
            role="combobox"
            isExpanded={isBoolOpen}
          />
          <TextInputGroupUtilities>
            {!!boolSelection && (
              <Button
                variant="plain"
                onClick={onBoolClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [boolSelection, isBoolOpen, onBoolClear],
  );

  const filtersComponents = useMemo(
    () => [
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
        {operationMode === 'multi' && (
          <MultiValueInput
            onValuesChange={(values) => setInValues(values)}
            style={{ height: 'inherit' }}
          />
        )}
      </React.Fragment>,
    ],
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
    ],
  );

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
        <Card>
          <CardBody className="pf-u-p-0">
            <FilterTable
              columns={COLUMNS}
              rows={rows}
              filters={filtersComponents}
              activeFilters={filters}
              pagination={pagination}
              isEmpty={rows.length === 0}
              isError={isError}
              onApplyFilter={applyFilter}
              onRemoveFilter={removeFilter}
              onClearFilters={clearFilters}
              onApplyReport={() =>
                navigate(
                  `/project/${params.project_id}/reports?${buildParams(filters).join('&')}`,
                )
              }
              onSetPage={setPage}
              onSetPageSize={setPageSize}
              hideFilters={['project_id']}
            />
          </CardBody>
          <CardFooter>
            <Text className="disclaimer" component="h4">
              * Note: for performance reasons, the total number of items is an
              approximation. Use the API with &lsquo;estimate=false&rsquo; if
              you need an accurate count.
            </Text>
          </CardFooter>
        </Card>
      </PageSection>
    </React.Fragment>
  );
};

RunList.propTypes = {};

export default RunList;
