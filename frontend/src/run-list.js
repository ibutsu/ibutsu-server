import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardFooter,
  PageSection,
  PageSectionVariants,
  Select,
  SelectOption,
  SelectVariant,
  Text,
  TextContent,
  TextInput
} from '@patternfly/react-core';
import { ChevronRightIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildBadge,
  buildParams,
  getActiveProject,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter,
  round
} from './utilities';
import { MultiValueInput, FilterTable } from './components';
import { OPERATIONS, RUN_FIELDS } from './constants';

export class RunSummary extends React.Component {
  static propTypes = {
    summary: PropTypes.object
  }

  render() {
    if (!this.props.summary) {
      return '';
    }
    const summary = this.props.summary;
    let passed = 0, failed = 0, errors = 0, skipped = 0, xfailed = 0, xpassed = 0;
    if (summary.tests) {
      passed = summary.tests;
    }
    if (summary.failures) {
      passed -= summary.failures;
      failed = summary.failures;
    }
    if (summary.errors) {
      passed -= summary.errors;
      errors = summary.errors;
    }
    if (summary.skips) {
      passed -= summary.skips;
      skipped = summary.skips;
    }
    if (summary.xfailures) {
      passed -= summary.xfailures;
      xfailed = summary.xfailures;
    }
    if (summary.xpasses) {
      passed -= summary.xpasses;
      xpassed = summary.xpasses;
    }
    return (
      <React.Fragment>
        {passed > 0 && <span className="pf-c-badge passed" title="Passed">{passed}</span>}
        {failed > 0 && <span className="pf-c-badge failed" title="Failed">{failed}</span>}
        {errors > 0 && <span className="pf-c-badge error" title="Error">{errors}</span>}
        {skipped > 0 && <span className="pf-c-badge skipped" title="Skipped">{skipped}</span>}
        {xfailed > 0 && <span className="pf-c-badge xfailed" title="Xfailed">{xfailed}</span>}
        {xpassed > 0 && <span className="pf-c-badge xpassed" title="Xpassed">{xpassed}</span>}
      </React.Fragment>
    );
  }
}

function runToRow(run, filterFunc) {
  let badges = [];
  let created = 0;
  let componentBadge;
  if (run.start_time) {
    created = new Date(run.start_time);
  }
  else {
      created = new Date(run.created);
  }

  if (filterFunc) {
    if (run.component) {
      componentBadge = buildBadge('component', run.component, false,
        () => filterFunc('component', run.component));
    }
  }
  else {
    componentBadge = buildBadge('component', run.component, false);
  }
  badges.push(componentBadge);

  if (run.env) {
    let envBadge;
    if (filterFunc) {
      envBadge = buildBadge(run.env, run.env, false,
        () => filterFunc('env', run.env));
    }
    else {
      envBadge = buildBadge(run.env, run.env, false);
    }
    badges.push(envBadge);
  }
  return {
    "cells": [
      {title: <React.Fragment><Link to={`/runs/${run.id}`}>{run.id}</Link> {badges}</React.Fragment>},
      {title: round(run.duration) + 's'},
      {title: <RunSummary summary={run.summary} />},
      {title: created.toLocaleString()},
      {title: <Link to={`/results?run_id=${run.id}`}>See results <ChevronRightIcon /></Link>}
    ]
  };
}

export class RunList extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
    eventEmitter: PropTypes.object
  }

  constructor(props) {
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
      columns: ['Run', 'Duration', 'Summary', 'Started', ''],
      rows: [getSpinnerRow(5)],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      filters: filters,
      fieldSelection: null,
      fieldOptions: RUN_FIELDS,
      isFieldOpen: false,
      operationSelection: 'eq',
      isOperationOpen: false,
      textFilter: '',
      isError: false,
      isEmpty: false,
      inValues: [],
      boolSelection: null,
      isBoolOpen: false,
    };
    this.params = new URLSearchParams(props.location.search);
    props.eventEmitter.on('projectChange', () => {
      this.getRuns();
    });
  }

  onFieldToggle = isExpanded => {
    this.setState({isFieldOpen: isExpanded});
  };

  onFieldSelect = (event, selection) => {
    this.setState({
      fieldSelection: selection,
      isFieldOpen: false,
      operationSelection: 'eq',
    });
  };

  onFieldClear = () => {
    this.setState({
      fieldSelection: null,
      isFieldOpen: false
    });
  };

  onFieldCreate = newValue => {
    this.setState({fieldOptions: [...this.state.fieldOptions, newValue]});
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
    let value = this.state.textFilter;
    if (operationMode === 'multi') {
      value = this.state.inValues.join(";");  // translate list to ;-separated string for BE
    }
    else if (operationMode === 'bool') {
      value = this.state.boolSelection;
    }
    this.updateFilters(field, operator, value, () => {
      this.updateUrl();
      this.getRuns();
      this.setState({
        fieldSelection: null,
        operationSelection: 'eq',
        textFilter: '',
        inValues: [],
        boolSelection: null,
      });
    });
  };

  updateFilters(name, operator, value, callback) {
    let filters = this.state.filters;
    if (!value) {
      delete filters[name];
    }
    else {
      filters[name] = {'op': operator, 'val': value};
    }
    this.setState({filters: filters, page: 1}, callback);
  }


  setFilter = (field, value) => {
    this.updateFilters(field, 'eq', value, () => {
      this.updateUrl();
      this.getRuns();
      this.setState({
        fieldSelection: null,
        operationSelection: 'eq',
        textFilter: '',
        boolSelection: null,
        inValues: []
      });
    });
  }


  removeFilter = id => {
    this.updateFilters(id, null, null, () => {
      this.updateUrl();
      this.setState({page: 1}, this.getRuns);
    });
  }

  updateUrl() {
    let params = buildParams(this.state.filters);
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.history.replace('/runs?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
      this.getRuns();
    });
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
      this.getRuns();
    });
  }

  getRuns() {
    // First, show a spinner
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    let params = {filter: []};
    let filters = this.state.filters;
    const project = getActiveProject();
    if (project) {
      filters['project_id'] = {'val': project.id, 'op': 'eq'};
    }
    else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
      delete filters['project_id']
    }
    params['estimate'] = true;
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;
    // Convert UI filters to API filters
    for (let key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && !!filters[key]) {
        const val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        params.filter.push(key + op + val);
      }
    }
    HttpClient.get([Settings.serverUrl, 'run'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.runs.map((run) => runToRow(run, this.setFilter)),
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching run data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  clearFilters = () => {
    this.setState({
      filters: [],
      page: 1,
      pageSize: 20,
      fieldSelection: null,
      operationSelection: 'eq',
      textFilter: '',
      inValues: [],
      boolSelection: null,
    }, function () {
      this.updateUrl();
      this.getRuns();
    });
  };

  componentDidMount() {
    this.getRuns();
  }

  render() {
    document.title = 'Test Runs | Ibutsu';
    const {
      columns,
      rows,
      fieldSelection,
      isFieldOpen,
      fieldOptions,
      isOperationOpen,
      operationSelection,
      textFilter,
      boolSelection,
      isBoolOpen,
    } = this.state;
    const filterMode = getFilterMode(fieldSelection);
    const operationMode = getOperationMode(operationSelection);
    const operations = getOperationsFromField(fieldSelection);
    const filters = [
      <Select
        aria-label="Select a field"
        placeholderText="Select a field"
        selections={fieldSelection}
        isOpen={isFieldOpen}
        isCreatable={true}
        variant={SelectVariant.typeahead}
        maxHeight={"1140%"}
        onToggle={this.onFieldToggle}
        onSelect={this.onFieldSelect}
        onCreateOption={this.onFieldCreate}
        onClear={this.onFieldClear}
        key="field"
      >
        {fieldOptions.map((option, index) => (
          <SelectOption key={index} value={option} />
        ))}
      </Select>,
      <Select
        variant={SelectVariant.single}
        onToggle={this.onOperationToggle}
        onSelect={this.onOperationSelect}
        isOpen={isOperationOpen}
        selections={operationSelection}
        key="operation"
      >
        {Object.keys(operations).map((option, index) => <SelectOption key={index} value={option}/>)}
      </Select>,
      <React.Fragment key="value">
        {(operationMode === 'bool') &&
        <Select
          aria-label="Select True/False"
          placeholderText="Select True/False"
          variant={SelectVariant.single}
          isOpen={isBoolOpen}
          selections={boolSelection}
          onToggle={this.onBoolToggle}
          onSelect={this.onBoolSelect}
          onClear={this.onBoolClear}
        >
          {["True", "False"].map((option, index) => (
            <SelectOption key={index} value={option} />
          ))}
        </Select>
        }
        {(filterMode === 'text' && operationMode === 'single') &&
          <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter || ''} onChange={this.onTextChanged} style={{height: "inherit"}}/>
        }
        {(operationMode === 'multi') &&
          <MultiValueInput onValuesChange={this.onInValuesChange} style={{height: "inherit"}}/>
        }
      </React.Fragment>
    ];
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <TextContent>
            <Text className="title" component="h1">Test runs</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          <Card>
            <CardBody className="pf-u-p-0">
              <FilterTable
                columns={columns}
                rows={rows}
                filters={filters}
                activeFilters={this.state.filters}
                pagination={pagination}
                isEmpty={this.state.isEmpty}
                isError={this.state.isError}
                onApplyFilter={this.applyFilter}
                onRemoveFilter={this.removeFilter}
                onClearFilters={this.clearFilters}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
                hideFilters={["project_id"]}
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
  }
}
