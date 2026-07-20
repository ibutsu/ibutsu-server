// TODO This component is incomplete
// The class was converted to functional react, but needs additional work.
// It's not in use in downstream environments at the moment
import { Fragment, useContext, useEffect, useMemo, useState } from 'react';

import {
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';

import { Link } from 'react-router';

import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import {
  buildBadge,
  getOperationsFromField,
  // parseFilter
} from '../utilities';
import FilterTable from '../components/filtering/filtered-table-card';
import MultiValueInput from '../components/multi-value-input';
import RunSummary from '../components/run-summary';
import {
  OPERATIONS,
  ACCESSIBILITY_FIELDS,
  OPERATION_MODE_MAP,
  FILTER_MODE_MAP,
} from '../constants';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { useFilterContext } from '../components/contexts/filter-context';

const runToRow = (run, filterFunc, analysisViewId) => {
  let badges = [];
  let badge;
  const created = run.start_time
    ? new Date(run.start_time)
    : new Date(run.created);

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
      analysisViewId ? (
        <Fragment key="run">
          <Link to={`../view/${analysisViewId}?run_list=${run.id}`}>
            {run.id}
          </Link>{' '}
          {badges}
        </Fragment>
      ) : (
        run.id
      ),
      <RunSummary key="summary" summary={run.summary} />,
      run.source,
      run.env,
      created.toLocaleString(),
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
  const [fieldOptions, setFieldOptions] = useState(ACCESSIBILITY_FIELDS);
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
      setFieldOptions((prev) => [...prev, fieldFilterValue]);
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

  // const onFieldClear = () => {
  //   setFieldSelection();
  //   setFieldInputValue('');
  //   setFieldFilterValue('');
  // };

  // const onFieldCreate = newValue => {
  //   this.setState({filteredFieldOptions: [...this.state.filteredFieldOptions, newValue]});
  // };

  const onOperationSelect = (_, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);

    // isMultiSelect: selection === 'in',  Wasn't in state originally, is only set here and never read?
  };

  const { updateFilters } = useFilterContext();

  const applyFilter = () => {
    const operationMode = OPERATION_MODE_MAP[operationSelection];
    let value;
    if (operationMode === 'multi') {
      value = inValues.join(';');
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
    const fetchData = async () => {
      setIsError(false);
      let analysisViewId = '';
      let httpParams = { filter: [] };
      let newFilters = { ...filters };
      const { primaryObject } = context;
      if (primaryObject) {
        newFilters['project_id'] = { val: primaryObject.id, op: 'eq' };
      } else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
        delete newFilters['project_id'];
      }
      try {
        const widgetResponse = await HttpClient.get(
          [Settings.serverUrl, 'widget-config'],
          { filter: 'widget=accessibility-analysis-view' },
        );
        const widgetData = await HttpClient.handleResponse(widgetResponse);
        analysisViewId = widgetData.widgets[0]?.id;
      } catch (error) {
        console.error(error);
      }
      httpParams.filter.push('metadata.accessibility@t');
      for (let key in newFilters) {
        if (
          Object.prototype.hasOwnProperty.call(newFilters, key) &&
          !!newFilters[key]
        ) {
          const val = newFilters[key]['val'];
          const op = OPERATIONS[newFilters[key]['op']].opChar;
          httpParams.filter.push(key + op + val);
        }
      }
      httpParams.filter = httpParams.filter.join();
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl + '/run'],
          httpParams,
        );
        const data = await HttpClient.handleResponse(response);
        setRows(
          data.runs.map((run) => runToRow(run, setFilters, analysisViewId)),
        );
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      } catch (error) {
        console.error('Error fetching accessibility run data:', error);
        setRows([]);
        setIsError(true);
      }
    };

    fetchData();
  }, [view, filters, context]);

  const filteredFieldOptions = useMemo(() => {
    if (!fieldInputValue) {
      return [...fieldOptions];
    }
    const filtered = fieldOptions.filter((menuItem) =>
      menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase()),
    );
    if (filtered.length !== 1 && !filtered.includes(fieldFilterValue)) {
      filtered.push(`Create "${fieldFilterValue}"`);
    }
    return filtered;
  }, [fieldFilterValue, fieldInputValue, fieldOptions]);

  useEffect(() => {
    const openDropdown = async () => {
      if (fieldInputValue && !isFieldOpen) {
        setIsFieldOpen(true);
      }
    };
    openDropdown();
  }, [fieldInputValue, isFieldOpen]);

  const filterMode = FILTER_MODE_MAP[fieldSelection];
  const operationMode = OPERATION_MODE_MAP[operationSelection];
  const operations = getOperationsFromField(fieldSelection);

  const jsxFilters = [
    <Select
      id="multi-typeahead-select"
      selected={fieldSelection}
      isOpen={isFieldOpen}
      onSelect={onFieldSelect}
      key="field"
      onOpenChange={() => setIsFieldOpen(false)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsFieldOpen(!isFieldOpen)}
          isExpanded={isFieldOpen}
        >
          {fieldSelection || 'Select field'}
        </MenuToggle>
      )}
    >
      <SelectList id="select-typeahead-listbox">
        {filteredFieldOptions.map((option) => (
          <SelectOption key={option} value={option}>
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
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOperationOpen(!isOperationOpen)}
          isExpanded={isOperationOpen}
        >
          {OPERATIONS[operationSelection]?.opString ||
            operationSelection ||
            'Select operation'}
        </MenuToggle>
      )}
    >
      <SelectList>
        {Object.keys(operations).map((option) => (
          <SelectOption key={option} value={option}>
            {operations[option]?.opString || option}
          </SelectOption>
        ))}
      </SelectList>
    </Select>,
    <Fragment key="value">
      {operationMode === 'bool' && (
        <Select
          id="single-select"
          isOpen={isBoolOpen}
          selected={boolSelection}
          onSelect={(selection) => {
            setBoolSelection(selection);
          }}
          onOpenChange={() => setIsBoolOpen(false)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsBoolOpen(!isBoolOpen)}
              isExpanded={isBoolOpen}
            >
              {boolSelection || 'Select value'}
            </MenuToggle>
          )}
        >
          <SelectList>
            {['True', 'False'].map((option) => (
              <SelectOption key={option} value={option}>
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
    </Fragment>,
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

export default AccessibilityDashboardView;
