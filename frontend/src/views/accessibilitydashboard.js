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

import { TimesIcon } from '@patternfly/react-icons';

import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildBadge,
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter
} from '../utilities';
import { FilterTable, MultiValueInput, RunSummary } from '../components';
import { OPERATIONS, ACCESSIBILITY_FIELDS } from '../constants';
import { IbutsuContext } from '../services/context';

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
  static contextType = IbutsuContext;
  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
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
      filteredFieldOptions: ACCESSIBILITY_FIELDS,
      fieldOptions: ACCESSIBILITY_FIELDS,
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

  updateUrl() {
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
  }

  setPageSize = (_event, perPage) => {
    let { pagination } = this.state;
    pagination.pageSize = perPage;
    this.setState({pagination}, () => {
      this.updateUrl();
      this.getData();
    });
  }

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
      })
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

  onOperationToggle = () => {
    this.setState({isOperationOpen: !this.state.isOperationOpen});
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

  onBoolToggle = () => {
    this.setState({isBoolOpen: !this.state.isBoolOpen});
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
        fieldInputValue: '',
        fieldFilterValue: '',
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
    const { primaryObject } = this.context;
    if (primaryObject) {
      filters['project_id'] = {'val': primaryObject.id, 'op': 'eq'};
    }
    else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
      delete filters['project_id']
    }
    // get the widget ID for the analysis view
    HttpClient.get([Settings.serverUrl, 'widget-config'], {"filter": "widget=accessibility-analysis-view"})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        analysisViewId = data.widgets[0]?.id
      }).catch(error => {
        console.log(error)
      });
    params.filter.push("metadata.accessibility@t")
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
  }

  componentDidUpdate(prevProps, prevState) {
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
                onClick={() => {this.onFieldClear()}}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    )

    const operationToggle = toggleRef => (
      <MenuToggle
        onClick={this.onOperationToggle}
        isExpanded={isOperationOpen}
        isFullWidth
        ref={toggleRef}
      >
        {this.state.operationSelection}
      </MenuToggle>
    )

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
    )

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
              {["True", "False"].map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        }
        {(filterMode === 'text' && operationMode === 'single') &&
          <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter || ''} onChange={(_event, newValue) => this.onTextChanged(newValue)} style={{height: "inherit"}}/>
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
