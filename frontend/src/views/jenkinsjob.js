import React from 'react';
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
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter
} from '../utilities';

import FilterTable from '../components/filtertable';
import MultiValueInput from '../components/multivalueinput';
import RunSummary from '../components/runsummary';
import { OPERATIONS, JJV_FIELDS } from '../constants';
import { IbutsuContext } from '../services/context';


function jobToRow (job, analysisViewId) {
  let start_time = new Date(job.start_time);
  return {
    cells: [
      analysisViewId ? {title: <Link to={`../view/${analysisViewId}?job_name=${job.job_name}`} relative='Path'>{job.job_name}</Link>} : job.job_name,
      {title: <a href={job.build_url} target="_blank" rel="noopener noreferrer">{job.build_number}</a>},
      {title: <RunSummary summary={job.summary} />},
      job.source,
      job.env,
      start_time.toLocaleString(),
      {title: <Link to={`../runs?metadata.jenkins.job_name[eq]=${job.job_name}&metadata.jenkins.build_number=${job.build_number}`} relative='Path'>See runs <ChevronRightIcon /></Link>}
    ]
  };
}

export class JenkinsJobView extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
    view: PropTypes.object
  };

  constructor (props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    let page = 1, pageSize = 20, filters = {};
    if (params.toString() !== '') {
      for(let pair of params) {
        if (pair[0] === 'page') {
          page = parseInt(pair[1]);
        }
        else if (pair[0] === 'pageSize') {
          pageSize = parseInt(pair[1]);
        }
        else {
          const combo = parseFilter(pair[0]);
          filters[combo['key']] = {
            'op': combo['op'],
            'val': pair[1]
          };
        }
      }
    }
    this.state = {
      rows: [getSpinnerRow(7)],
      columns: ['Job name', 'Build number', 'Summary', 'Source', 'Env', 'Started', ''],
      pagination: {page: page, pageSize: pageSize, totalItems: 0},
      filters: filters,
      isEmpty: true,
      isError: false,
      fieldSelection: null,
      filteredFieldOptions: JJV_FIELDS,
      fieldOptions: JJV_FIELDS,
      fieldInputValue: '',
      fieldFilterValue: '',
      isFieldOpen: false,
      operationSelection: 'eq',
      isOperationOpen: false,
      textFilter: '',
      inValues: [],
      boolSelection: null,
      isBoolOpen: false,
    };
  }

  updateUrl () {
    let params = buildParams(this.state.filters);
    params.push('page=' + this.state.pagination.page);
    params.push('pageSize=' + this.state.pagination.pageSize);
    this.props.navigate(this.props.location.pathname + '?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    let { pagination } = this.state;
    pagination.page = pageNumber;
    this.setState({pagination}, () => {
      this.updateUrl();
      this.getData();
    });
  };

  setPageSize = (_event, perPage) => {
    let { pagination } = this.state;
    pagination.pageSize = perPage;
    this.setState({pagination}, () => {
      this.updateUrl();
      this.getData();
    });
  };

  onFieldToggle = () => {
    this.setState({isFieldOpen: !this.state.isFieldOpen});
  };

  onFieldSelect = (_event, selection) => {
    const fieldFilterValue = this.state.fieldFilterValue;
    if (selection == `Create "${fieldFilterValue}"`) {
      this.setState({
        filteredFieldOptions: [...this.state.fieldOptions, fieldFilterValue],
        fieldSelection: fieldFilterValue,
        fieldInputValue: fieldFilterValue,
        operationSelection: 'eq',
      });
    }
    else {
      this.setState({
        fieldSelection: selection,
        fieldInputValue: selection,
        isFieldOpen: false,
        operationSelection: 'eq',
      });
    }
  };

  onFieldTextInputChange = (_event, value) => {
    this.setState({fieldInputValue: value});
    this.setState({fieldFilterValue: value});
  };

  onFieldClear = () => {
    this.setState({
      fieldSelection: null,
      fieldInputValue: '',
      fieldFilterValue: ''
    });
  };

  onFieldCreate = newValue => {
    this.setState({filteredFieldOptions: [...this.state.filteredFieldOptions, newValue]});
  };

  onOperationToggle = isExpanded => {
    this.setState({isOperationOpen: isExpanded});
  };

  onOperationSelect = (event, selection) => {
    this.setState({
      operationSelection: selection,
      isOperationOpen: false,
      isMultiSelect: selection === 'in',
    });
  };

  onOperationClear = () => {
    this.setState({
      operationSelection: null,
      isOperationOpen: false
    });
  };

  onTextChanged = newValue => {
    this.setState({textFilter: newValue});
  };

  onInValuesChange = (values) => {
    this.setState({inValues: values});
  };

  onBoolSelect = (event, selection) => {
    this.setState({
      boolSelection: selection,
      isBoolOpen: false
    });
  };

  onBoolToggle = isExpanded => {
    this.setState({isBoolOpen: isExpanded});
  };

  onBoolClear = () => {
    this.setState({
      boolSelection: null,
      isBoolOpen: false
    });
  };

  applyFilter = () => {
    const field = this.state.fieldSelection;
    const operator = this.state.operationSelection;
    const operationMode = getOperationMode(operator);
    let value = this.state.textFilter.trim();
    if (operationMode === 'multi') {
      // translate list to ;-separated string for BE
      value = this.state.inValues.map(item => item.trim()).join(';');
    }
    else if (operationMode === 'bool') {
      value = this.state.boolSelection;
    }
    this.updateFilters(field, operator, value, () => {
      this.updateUrl();
      this.getData();
      this.setState({
        fieldSelection: null,
        fieldInputValue: '',
        fieldFilterValue: '',
        operationSelection: 'eq',
        textFilter: '',
        inValues: [],
        boolSelection: null,
      });
    });
  };

  updateFilters (name, operator, value, callback) {
    let { filters, pagination } = this.state;
    if (!value) {
      delete filters[name];
    }
    else {
      filters[name] = {'op': operator, 'val': value};
    }
    pagination.page = 1;
    this.setState({filters: filters, pagination: pagination}, callback);
  }

  removeFilter = id => {
    let { pagination } = this.state;
    this.updateFilters(id, null, null, () => {
      this.updateUrl();
      pagination.page = 1;
      this.setState({pagination}, this.getData);
    });
  };


  getData () {
    let analysisViewId = '';
    const filters = this.state.filters;
    let params = this.props.view.params;

    // get the widget ID for the analysis view
    HttpClient.get([Settings.serverUrl, 'widget-config'], {'filter': 'widget=jenkins-analysis-view'})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        analysisViewId = data.widgets[0]?.id;
      }).catch(error => {
        console.log(error);
      });
    // Show a spinner
    this.setState({rows: [getSpinnerRow(7)], isEmpty: false, isError: false});
    if (!this.props.view) {
      return;
    }

    const { primaryObject } = this.context;
    if (primaryObject) {
      params['project'] = primaryObject.id;
    }
    else {
      delete params['project'];
    }
    params['page_size'] = this.state.pagination.pageSize;
    params['page'] = this.state.pagination.page;
    params['filter'] = [];
    // Convert UI filters to API filters
    for (let key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && !!filters[key]) {
        const val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        params.filter.push(key + op + val);
      }
    }
    params.filter = params.filter.join();  // convert array to a comma-separated string
    HttpClient.get([Settings.serverUrl, 'widget', this.props.view.widget], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({
          rows: data.jobs.map(job => jobToRow(job, analysisViewId)),
          pagination: data.pagination,
          isEmpty: data.pagination.totalItems === 0
        });
      })
      .catch((error) => {
        console.error('Error fetching Jenkins data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  componentDidMount () {
    this.getData();
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevProps.view !== this.props.view) {
      this.getData();
    }

    if (
      prevState.fieldFilterValue !== this.state.fieldFilterValue
    ) {
      let newSelectOptionsField = this.state.fieldOptions;
      if (this.state.fieldInputValue) {
        newSelectOptionsField = this.state.fieldOptions.filter(menuItem =>
          menuItem.toLowerCase().includes(this.state.fieldFilterValue.toLowerCase())
        );
        if (newSelectOptionsField.length !== 1 && !newSelectOptionsField.includes(this.state.fieldFilterValue) ) {
          newSelectOptionsField.push(`Create "${this.state.fieldFilterValue}"`);
        }

        if (!this.state.isFieldOpen) {
          this.setState({ isFieldOpen: true });
        }
      }

      this.setState({
        filteredFieldOptions: newSelectOptionsField,
      });
    }
  }

  render () {
    const {
      columns,
      rows,
      boolSelection,
      fieldSelection,
      isFieldOpen,
      filteredFieldOptions,
      fieldInputValue,
      isBoolOpen,
      isEmpty,
      isError,
      isOperationOpen,
      operationSelection,
      pagination,
      textFilter,
    } = this.state;

    const filterMode = getFilterMode(fieldSelection);
    const operationMode = getOperationMode(operationSelection);
    const operations = getOperationsFromField(fieldSelection);

    const fieldToggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        aria-label="Typeahead creatable menu toggle"
        onClick={this.onFieldToggle}
        isExpanded={this.state.isFieldOpen}
        isFullWidth
        innerRef={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={fieldInputValue}
            onClick={this.onFieldToggle}
            onChange={this.onFieldTextInputChange}
            id="create-typeahead-select-input"
            autoComplete="off"
            placeholder="Select a field"
            role="combobox"
            isExpanded={this.state.isFieldOpen}
            aria-controls="select-create-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {!!fieldInputValue && (
              <Button
                variant="plain"
                onClick={() => {this.onFieldClear();}}
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
        onClick={this.onOperationToggle}
        isExpanded={isOperationOpen}
        isFullWidth
        ref={toggleRef}
      >
        {this.state.operationSelection}
      </MenuToggle>
    );

    const boolToggle = toggleRef => (
      <MenuToggle
        onClick={this.onBoolToggle}
        isExpanded={this.state.isBoolOpen}
        isFullWidth
        ref={toggleRef}
        style={{maxHeight: '36px'}}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={boolSelection}
            onClick={this.onBoolToggle}
            autoComplete="off"
            placeholder="Select True/False"
            role="combobox"
            isExpanded={this.state.isBoolOpen}
          />
          <TextInputGroupUtilities>
            {!!boolSelection && (
              <Button variant="plain" onClick={() => {
                this.onBoolClear();
              }} aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );

    const filters = [
      <Select
        id="multi-typeahead-select"
        selected={fieldSelection}
        isOpen={isFieldOpen}
        onSelect={this.onFieldSelect}
        key="field"
        onOpenChange={() => this.setState({isFieldOpen: false})}
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
        onSelect={this.onOperationSelect}
        onOpenChange={() => this.setState({isOperationOpen: false})}
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
            onSelect={this.onBoolSelect}
            onOpenChange={() => this.setState({isBoolOpen: false})}
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
          <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter || ''} onChange={(_event, newValue) => this.onTextChanged(newValue)} style={{height: 'inherit'}}/>
        }
        {(operationMode === 'multi') &&
          <MultiValueInput onValuesChange={this.onInValuesChange} style={{height: 'inherit'}}/>
        }
      </React.Fragment>
    ];

    return (
      <Card>
        <CardBody className="pf-u-p-0">
          <FilterTable
            columns={columns}
            rows={rows}
            filters={filters}
            pagination={pagination}
            isEmpty={isEmpty}
            isError={isError}
            onSetPage={this.setPage}
            onSetPageSize={this.setPageSize}
            onApplyFilter={this.applyFilter}
            onRemoveFilter={this.removeFilter}
            onClearFilters={this.clearFilters}
            activeFilters={this.state.filters}
          />
        </CardBody>
      </Card>
    );
  }
}
