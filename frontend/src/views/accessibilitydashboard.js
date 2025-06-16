// TODO This component is incomplete
// The class was converted to functional react, but needs additional work.
// It's not in use in downstream environments at the moment
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
	Button,
	MenuToggle,
	SelectList,
	TextInput,
	TextInputGroup,
	TextInputGroupMain,
	TextInputGroupUtilities
} from '@patternfly/react-core';
import {
	Select,
	SelectOption
} from '@patternfly/react-core/deprecated';

import { TimesIcon } from '@patternfly/react-icons';

import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildBadge,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  // parseFilter
} from '../utilities';
import FilterTable from '../components/filtering/filtered-table-card';
import MultiValueInput from '../components/multivalueinput';
import RunSummary from '../components/runsummary';
import { OPERATIONS, ACCESSIBILITY_FIELDS } from '../constants';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import useTableFilters from '../components/hooks/useTableFilters';

const runToRow = (run, filterFunc, analysisViewId) => {
  let badges = [];
  let created = 0;
  let badge;
  if (run.start_time) {
    created = new Date(run.start_time);
  } else {
    created = new Date(run.created);
  }

  if (filterFunc) {
    if (run.component) {
      badge = buildBadge('component', run.component, false, () =>
        filterFunc('component', run.component),
      );
    }
  } else {
    badge = buildBadge('component', run.component, false);
  }
  badges.push(badge);

  if (run.env) {
    let badge;
    if (filterFunc) {
      badge = buildBadge(run.env, run.env, false, () =>
        filterFunc('env', run.env),
      );
    } else {
      badge = buildBadge(run.env, run.env, false);
    }
    badges.push(badge);
  }
  return {
    cells: [
      analysisViewId
        ? {
            title: (
              <React.Fragment>
                <Link to={`../view/${analysisViewId}?run_list=${run.id}`}>
                  {run.id}
                </Link>{' '}
                {badges}
              </React.Fragment>
            ),
          }
        : run.id,
      { title: <RunSummary summary={run.summary} /> },
      { title: run.source },
      { title: run.env },
      { title: created.toLocaleString() },
    ],
  };
};

const fieldToColumnName = (fields) => {
  // For each value in fields, changes from ex_ample to Ex Ample
  let results = [];
  for (let i = 0; i < fields.length; i++) {
    let tmp_item = fields[i];
    tmp_item = tmp_item
      .replace(/_/g, ' ')
      .replace(/(?: |\b)(\w)/g, (key) => key.toUpperCase());
    results.push(tmp_item);
  }
  return results;
};

const COLUMNS = [...fieldToColumnName(ACCESSIBILITY_FIELDS)];

const AccessibilityDashboardView = ({ view }) => {
  const context = useContext(IbutsuContext);
  // const params = useSearchParams();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState();
  const [filters, setFilters] = useState({});

  // const combo = parseFilter(pair[0]);
  // filters[combo['key']] = {
  //   'operator': combo['op'],
  //   'val': pair[1]
  // };

  // states
  const [rows, setRows] = useState();

  const [isError, setIsError] = useState(false);

  const [fieldSelection, setFieldSelection] = useState();
  const [filteredFieldOptions, setFilteredFieldOptions] =
    useState(ACCESSIBILITY_FIELDS);
  const [fieldOptions] = useState(ACCESSIBILITY_FIELDS);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState(''); // same as fieldInputValue?
  const [isFieldOpen, setIsFieldOpen] = useState(false);

  const [operationSelection, setOperationSelection] = useState('eq');
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const [textFilter, setTextFilter] = useState('');
  const [inValues, setInValues] = useState([]);
  const [boolSelection, setBoolSelection] = useState();
  const [isBoolOpen, setIsBoolOpen] = useState(false);

  // TODO sync params for pagination and filters?

  const onFieldSelect = (_, selection) => {
    if (selection == `Create "${fieldFilterValue}"`) {
      setFilteredFieldOptions([...fieldOptions, fieldFilterValue]);
      setFieldSelection(fieldFilterValue);
      setFieldInputValue(fieldFilterValue);
      setOperationSelection('eq');
    } else {
      setFieldSelection(selection);
      setFieldInputValue(selection);
      setIsFieldOpen(false);
      setOperationSelection('eq');
    }
  };

  const onFieldClear = () => {
    setFieldSelection();
    setFieldInputValue('');
    setFieldFilterValue('');
  };

  // const onFieldCreate = newValue => {
  //   this.setState({filteredFieldOptions: [...this.state.filteredFieldOptions, newValue]});
  // };

  const onOperationSelect = (_, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);

    // isMultiSelect: selection === 'in',  Wasn't in state originally, is only set here and never read?
  };

  const { updateFilters } = useTableFilters();

  const applyFilter = () => {
    const operationMode = getOperationMode(operationSelection);
    let value = '';
    if (operationMode === 'multi') {
      value = inValues.join(';'); // translate list to ;-separated string for BE
    } else if (operationMode === 'bool') {
      value = boolSelection;
    } else {
      value = textFilter;
    }

    updateFilters(fieldSelection, operationMode, value, () => {
      setFieldSelection();
      setFieldInputValue('');
      setFieldFilterValue('');
      setOperationSelection('eq');
      setTextFilter('');
      setInValues([]);
      setBoolSelection();
    });
  };

  useEffect(() => {
    // First, show a spinner
    setIsError(false);
    let analysisViewId = '';
    let httpParams = { filter: [] };
    let newFilters = { ...filters };
    const { primaryObject } = context;
    if (primaryObject) {
      // todo array of filters
      newFilters['project_id'] = { val: primaryObject.id, operator: 'eq' };
    } else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
      delete newFilters['project_id'];
    }
    // get the widget ID for the analysis view
    HttpClient.get([Settings.serverUrl, 'widget-config'], {
      filter: 'widget=accessibility-analysis-view',
    })
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        analysisViewId = data.widgets[0]?.id;
      })
      .catch((error) => {
        console.error(error);
      });
    httpParams.filter.push('metadata.accessibility@t');
    // Convert UI filters to API filters
    for (let key in newFilters) {
      if (
        Object.prototype.hasOwnProperty.call(newFilters, key) &&
        !!newFilters[key]
      ) {
        const val = newFilters[key]['val'];
        const op = OPERATIONS[newFilters[key]['op']];
        httpParams.filter.push(key + op + val);
      }
    }

    httpParams.filter = httpParams.filter.join();
    HttpClient.get([Settings.serverUrl + '/run'], httpParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setRows(
          data.runs.map((run) => runToRow(run, setFilters, analysisViewId)),
        );
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      })
      .catch((error) => {
        console.error('Error fetching accessibility run data:', error);
        setRows([]);
        setIsError(true);
      });
  }, [view, filters, context]);

  useEffect(() => {
    let newSelectOptionsField = { ...fieldOptions };
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

      if (!isFieldOpen) {
        setIsFieldOpen(true);
      }
    }

    setFilteredFieldOptions(newSelectOptionsField);
  }, [fieldFilterValue, fieldInputValue, fieldOptions, isFieldOpen]);

  const filterMode = getFilterMode(fieldSelection);
  const operationMode = getOperationMode(operationSelection);
  const operations = getOperationsFromField(fieldSelection);

  const fieldToggle = (toggleRef) => (
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
          onChange={(value) => {
            setFieldFilterValue(value);
            setFieldInputValue(value);
          }}
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
              onClick={() => {
                onFieldClear();
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

  const operationToggle = (toggleRef) => (
    <MenuToggle
      onClick={() => setIsOperationOpen(!isOperationOpen)}
      isExpanded={isOperationOpen}
      isFullWidth
      ref={toggleRef}
    >
      {operationSelection}
    </MenuToggle>
  );

  const boolToggle = (toggleRef) => (
    <MenuToggle
      onClick={() => {
        setIsBoolOpen(!isBoolOpen);
      }}
      isExpanded={isBoolOpen}
      isFullWidth
      ref={toggleRef}
      style={{ maxHeight: '36px' }}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={boolSelection}
          onClick={() => {
            setIsBoolOpen(!isBoolOpen);
          }}
          autoComplete="off"
          placeholder="Select True/False"
          role="combobox"
          isExpanded={isBoolOpen}
        />
        <TextInputGroupUtilities>
          {!!boolSelection && (
            <Button
              variant="plain"
              onClick={() => {
                setBoolSelection();
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

  const jsxFilters = [
    <Select
      id="multi-typeahead-select"
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
          onSelect={(selection) => {
            setBoolSelection(selection);
          }}
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
          onChange={(_, value) => setTextFilter(value)}
          style={{ height: 'inherit' }}
        />
      )}
      {operationMode === 'multi' && (
        <MultiValueInput
          onValuesChange={(_, values) => setInValues(values)}
          style={{ height: 'inherit' }}
        />
      )}
    </React.Fragment>,
  ];

  return (
    <FilterTable
      columns={COLUMNS}
      rows={rows}
      filters={jsxFilters}
      pageSize={pageSize}
      page={page}
      totalItems={totalItems}
      isError={isError}
      onSetPage={(_, value) => setPage(value)}
      onSetPageSize={(_, value) => setPageSize(value)}
      onApplyFilter={applyFilter}
      onClearFilters={() => setTextFilter('')}
      removeCallback={() => setPage(1)}
    />
  );
};

AccessibilityDashboardView.propTypes = {
  view: PropTypes.object,
};

export default AccessibilityDashboardView;
