import React, { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities
} from '@patternfly/react-core';
import { ChevronRightIcon, TimesIcon } from '@patternfly/react-icons';

import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  toAPIFilter
} from '../utilities';

import FilterTable from '../components/filtertable';
import MultiValueInput from '../components/multivalueinput';
import RunSummary from '../components/runsummary';
import { JJV_FIELDS } from '../constants';
import { IbutsuContext } from '../services/context';

const COLUMNS = ['Job name', 'Build number', 'Summary', 'Source', 'Env', 'Started', ''];
const DEFAULT_OPERATION = 'eq';

const JenkinsJobView = (props) => {
  const {view} = props;
  const context = useContext(IbutsuContext);
  const { primaryObject } = context;

  const [analysisViewId, setAnalysisViewId] = useState();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [filters, setFilters] = useState({});

  const [rows, setRows] = useState([getSpinnerRow(7)]);

  const [isError, setIsError] = useState(false);

  const [fieldSelection, setFieldSelection] = useState();
  const [filteredFieldOptions, setFilteredFieldOptions] = useState(JJV_FIELDS);
  const [fieldOptions] = useState(JJV_FIELDS);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState('');  // same as fieldInputValue?
  const [isFieldOpen, setIsFieldOpen] = useState(false);

  const [operationSelection, setOperationSelection] = useState(DEFAULT_OPERATION);
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const [textFilter, setTextFilter] = useState('');
  const [inValues, setInValues] = useState([]);
  const [boolSelection, setBoolSelection] = useState(false);
  const [isBoolOpen, setIsBoolOpen] = useState(false);


  const onFieldSelect = (_event, selection) => {
    if (selection == `Create "${fieldFilterValue}"`) {
      setFilteredFieldOptions([...fieldOptions, fieldFilterValue]);
      setFieldSelection(fieldFilterValue);
      setFieldInputValue(fieldFilterValue);
    }
    else {
      setFieldSelection(selection);
      setFieldInputValue(selection);
    }

    setIsFieldOpen(false);

  };

  const onFieldTextInputChange = (_, value) => {
    setFieldInputValue(value);
    setFieldFilterValue(value);
  };

  const onFieldClear = () => {
    setFieldSelection('');
    setFieldFilterValue('');
    setFieldInputValue('');
  };

  const onOperationToggle = isExpanded => {
    setIsOperationOpen(isExpanded);
  };

  const onOperationSelect = (_, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
  };

  const onTextChanged = newValue => {
    setTextFilter(newValue);
  };

  const onBoolSelect = (_, selection) => {
    setBoolSelection(selection);
    setIsBoolOpen(false);
  };

  const onBoolClear = () => {
    setBoolSelection();
    setIsBoolOpen(false);
  };

  const applyFilter = () => {
    const operationMode = getOperationMode(operationSelection);
    let value = textFilter.trim();
    if (operationMode === 'multi') {
      // translate list to ;-separated string for BE
      value = inValues.map(item => item.trim()).join(';');
    }
    else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters(fieldSelection, operationSelection, value, () => {
      setFieldSelection();
      setFieldInputValue('');
      setFieldFilterValue('');
      setOperationSelection(DEFAULT_OPERATION);
      setTextFilter('');
      setInValues([]);
      setBoolSelection(false);
    });
  };

  const updateFilters = (name, operator, value, callback) => {
    const newFilters = {...filters};
    if (!value) {
      delete newFilters[name];
    }
    else {
      newFilters[name] = {'op': operator, 'val': value};
    }
    setPage(1);
    setFilters(newFilters);
    callback();
  };

  const removeFilter = id => {
    updateFilters(id, null, null, () => {});
  };

  useEffect(() =>{
    // get the widget ID for the analysis view
    HttpClient.get([Settings.serverUrl, 'widget-config'], {'filter': 'widget=jenkins-analysis-view'})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setAnalysisViewId(data.widgets[0]?.id);
      }).catch(error => {
        console.log(error);
      });
  }, []);

  const jobToRow = useCallback((job) => (
    {
      cells: [
        analysisViewId ? {title: <Link to={`../view/${analysisViewId}?job_name=${job.job_name}`} relative='Path'>{job.job_name}</Link>} : job.job_name,
        {title: <a href={job.build_url} target="_blank" rel="noopener noreferrer">{job.build_number}</a>},
        {title: <RunSummary summary={job.summary} />},
        job.source,
        job.env,
        new Date(job.start_time).toLocaleString(),
        {title: <Link to={`../runs?metadata.jenkins.job_name[eq]=${job.job_name}&metadata.jenkins.build_number=${job.build_number}`} relative='Path'>See runs <ChevronRightIcon /></Link>}
      ]
    }
  ), [analysisViewId]);

  useEffect(() => {
    if (view) {
      let analysisViewId = '';
      let params = {...view.params};
      setIsError(false);

      if (primaryObject) {
        params['project'] = primaryObject.id;
      }
      else {
        delete params['project'];
      }
      params['page_size'] = pageSize;
      params['page'] = page;
      params['filter'] = toAPIFilter(filters).join();

      HttpClient.get([Settings.serverUrl, 'widget', view.widget], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setRows(data.jobs.map(job => jobToRow(job, analysisViewId)));
          setTotalItems(data.pagination.totalItems);
        })
        .catch((error) => {
          console.error('Error fetching Jenkins data:', error);
          setIsError(true);
          setRows([]);
        });
    }
  }, [filters, page, pageSize, primaryObject, view, jobToRow]);

  useEffect(() => {
    let newSelectOptionsField = [...fieldOptions];
    if (fieldInputValue) {
      newSelectOptionsField = fieldOptions.filter(menuItem =>
        menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase())
      );
      if (newSelectOptionsField.length !== 1 && !newSelectOptionsField.includes(fieldFilterValue) ) {
        newSelectOptionsField.push(`Create "${fieldFilterValue}"`);
      }
    }

    setFilteredFieldOptions(newSelectOptionsField);
  }, [fieldFilterValue, fieldInputValue, fieldOptions, isFieldOpen]);


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
      onClick={onOperationToggle}
      isExpanded={isOperationOpen}
      isFullWidth
      ref={toggleRef}
    >
      {operationSelection}
    </MenuToggle>
  );

  const boolToggle = toggleRef => (
    <MenuToggle
      onClick={(value) => setIsBoolOpen(value)}
      isExpanded={isBoolOpen}
      isFullWidth
      ref={toggleRef}
      style={{maxHeight: '36px'}}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={boolSelection}
          onClick={(value) => setIsBoolOpen(value)}
          autoComplete="off"
          placeholder="Select True/False"
          role="combobox"
          isExpanded={isBoolOpen}
        />
        <TextInputGroupUtilities>
          {!!boolSelection && (
            <Button variant="plain" onClick={onBoolClear} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  const filterElements = [
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
        {Object.keys(getOperationsFromField(fieldSelection)).map((option, index) => (
          <SelectOption key={index} value={option}>
            {option}
          </SelectOption>
        ))}
      </SelectList>
    </Select>,
    <React.Fragment key="value">
      {(getOperationMode(operationSelection) === 'bool') &&
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
      {(getFilterMode(fieldSelection) === 'text' && getOperationMode(operationSelection) === 'single') &&
        <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter} onChange={(_, newValue) => onTextChanged(newValue)} style={{height: 'inherit'}}/>
      }
      {(getOperationMode(operationSelection) === 'multi') &&
        <MultiValueInput onValuesChange={(values) => setInValues(values)} style={{height: 'inherit'}}/>
      }
    </React.Fragment>
  ];

  return (
    <Card>
      <CardBody className="pf-u-p-0">
        <FilterTable
          columns={COLUMNS}
          rows={rows}
          filters={filterElements}
          pagination={{
            page: page,
            pageSize: pageSize,
            totalItems: totalItems
          }}
          isEmpty={rows.length === 0}
          isError={isError}
          onSetPage={(_, value) => setPage(value)}
          onSetPageSize={(_, value) => setPageSize(value)}
          onApplyFilter={applyFilter}
          onRemoveFilter={removeFilter}
          activeFilters={filters}
        />
      </CardBody>
    </Card>
  );
};

JenkinsJobView.propTypes = {
  view: PropTypes.object
};

export default JenkinsJobView;
