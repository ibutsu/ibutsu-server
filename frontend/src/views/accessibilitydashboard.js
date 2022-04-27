import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  Select,
  SelectOption,
  SelectVariant,
  TextInput,
} from '@patternfly/react-core';
//import { ChevronRightIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildBadge,
  //round,
  buildParams,
  getActiveProject,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter
} from '../utilities';
import { FilterTable, MultiValueInput, RunSummary } from '../components';
import { OPERATIONS, ACCESSIBILITY_FIELDS } from '../constants';

function runToRow(run, filterFunc, analysisViewId) {
  let badges = [];
  let created = 0;
  let badge;
  if (run.start_time) {
    created = new Date(run.start_time);
  }
  else {
      created = new Date(run.created);
  }

  if (filterFunc) {
    if (run.component) {
      badge = buildBadge('component', run.component, false,
        () => filterFunc('component', run.component));
    }
  }
  else {
    badge = buildBadge('component', run.component, false);
  }
  badges.push(badge);

  if (run.env) {
    let badge;
    if (filterFunc) {
      badge = buildBadge(run.env, run.env, false,
        () => filterFunc('env', run.env));
    }
    else {
      badge = buildBadge(run.env, run.env, false);
    }
    badges.push(badge)
  }
  return {
    "cells": [
      analysisViewId ? {title: <React.Fragment><Link to={`/view/${analysisViewId}?run_list=${run.id}`}>{run.id}</Link> {badges}</React.Fragment>} : run.id,
      {title: <RunSummary summary={run.summary} />},
      {title: run.source},
      {title: run.env},
      //{title: <Link to={`/results?run_id=${run.id}`}>See results <ChevronRightIcon /></Link>}
      {title: created.toLocaleString()}
    ]
  };
}

function fieldToColumnName(fields) {
  // For each value in fields, changes from ex_ample to Ex Ample
  let results = [];
  for (var i = 0; i < fields.length; i++) {
    let tmp_item = fields[i];
    tmp_item = tmp_item.replace(/_/g, ' ').replace(/(?: |\b)(\w)/g, function(key) { return key.toUpperCase()});
    results.push(tmp_item);
  }
  return results;
}

export class AccessibilityDashboardView extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
    view: PropTypes.object
  };

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
      rows: [getSpinnerRow(7)],
      columns: [...fieldToColumnName(ACCESSIBILITY_FIELDS), ''],
      pagination: {page: page, pageSize: pageSize, totalItems: 0},
      filters: filters,
      isEmpty: true,
      isError: false,
      fieldSelection: null,
      fieldOptions: ACCESSIBILITY_FIELDS,
      isFieldOpen: false,
      operationSelection: 'eq',
      isOperationOpen: false,
      textFilter: '',
      inValues: [],
      boolSelection: null,
      isBoolOpen: false,
    };
  }

  updateUrl() {
    let params = buildParams(this.state.filters);
    params.push('page=' + this.state.pagination.page);
    params.push('pageSize=' + this.state.pagination.pageSize);
    this.props.history.replace(this.props.location.pathname + '?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    let { pagination } = this.state;
    pagination.page = pageNumber;
    this.setState({pagination}, () => {
      this.updateUrl();
      this.getData();
    });
  }

  setPageSize = (_event, perPage) => {
    let { pagination } = this.state;
    pagination.pageSize = perPage;
    this.setState({pagination}, () => {
      this.updateUrl();
      this.getData();
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
      this.getData();
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
  }

  getData() {
    // First, show a spinner
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    let analysisViewId = '';
    let params = {filter: []};
    let filters = this.state.filters;
    const project = getActiveProject();
    if (project) {
      filters['project_id'] = {'val': project.id, 'op': 'eq'};
    }
    else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
      delete filters['project_id']
    }
    // get the widget ID for the analysis view
    HttpClient.get([Settings.serverUrl + '/widget-config'], {"filter": "widget=accessibility-analysis-view"})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        analysisViewId = data.widgets[0].id
      }).catch(error => {
        console.log(error)
      });
    // get the widget ID for the analysis view
    /*
    fetch(buildUrl(Settings.serverUrl + '/widget-config', {"filter": "widget=accessibility-analysis-view"}))
      .then(response => response.json())
      .then(data => {
          analysisViewId = data.widgets[0].id
      }).catch(error => {
        console.log(error);
      });
    */
    params.filter.push("metadata.accessibility@t")
    //params['estimate'] = true;
    //params['pageSize'] = this.state.pagination.pageSize;
    //params['page'] = this.state.pagination.page;
    // Convert UI filters to API filters
    for (let key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && !!filters[key]) {
        const val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        params.filter.push(key + op + val);
      }
    }

    params.filter = params.filter.join();
    HttpClient.get([Settings.serverUrl + '/run'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.runs.map((run) => runToRow(run, this.setFilter, analysisViewId)),
        pagination: data.pagination,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }
      ))

      .catch((error) => {
        console.error('Error fetching accessibility run data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
    /*
    fetch(buildUrl(Settings.serverUrl + '/run', params))
      .then(response => response.json())
      .then(data => this.setState({
        rows: data.runs.map((run) => runToRow(run, this.setFilter, analysisViewId)),
        pagination: data.pagination,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching accessibility run data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
      */
  }

  componentDidUpdate(prevProps) {
    if (prevProps.view !== this.props.view) {
      this.getData();
    }
  }

  componentDidMount() {
    this.getData();
  }

  render() {
    const {
      columns,
      rows,
      boolSelection,
      fieldSelection,
      isFieldOpen,
      fieldOptions,
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
