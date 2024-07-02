import React from 'react';
import PropTypes from 'prop-types';

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
  TextInputGroupUtilities
} from '@patternfly/react-core';
import { ChevronRightIcon, TimesIcon } from '@patternfly/react-icons';

import { Link } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildBadge,
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter,
  round
} from './utilities';
import { MultiValueInput, FilterTable, RunSummary } from './components';
import { OPERATIONS, RUN_FIELDS } from './constants';
import { IbutsuContext } from './services/context';


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
  static contextType = IbutsuContext;

  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
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
      filteredFieldOptions: RUN_FIELDS,
      fieldOptions: RUN_FIELDS,
      fieldInputValue: '',
      fieldFilterValue: '',
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
    props.eventEmitter.on('projectChange', (value) => {
      this.getRuns(value);
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
      fieldFilterValue: '',
      fieldInputValue: '',
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
    let value = this.state.textFilter.trim();
    if (operationMode === 'multi') {
      // translate list to ;-separated string for BE
      value = this.state.inValues.map(item => item.trim()).join(";");
    }
    else if (operationMode === 'bool') {
      value = this.state.boolSelection;
    }
    this.updateFilters(field, operator, value, () => {
      this.updateUrl();
      this.getRuns();
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
    this.props.navigate('/runs?' + params.join('&'))
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

  getRuns = (handledOject = null) => {
    // First, show a spinner
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    let params = {filter: []};
    let filters = this.state.filters;
    const { primaryObject } = this.context;
    const targetObject = handledOject ?? primaryObject;
    if (targetObject) {
      filters['project_id'] = {'val': targetObject.id, 'op': 'eq'};
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
  };

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
    });
    this.updateUrl();
  };

  componentDidMount() {
    this.getRuns();
  }

  componentDidUpdate(prevProps, prevState) {
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

  render() {
    document.title = 'Test Runs | Ibutsu';
    const {
      columns,
      rows,
      fieldSelection,
      isFieldOpen,
      filteredFieldOptions,
      fieldInputValue,
      isOperationOpen,
      operationSelection,
      textFilter,
      boolSelection,
      isBoolOpen,
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
        isExpanded={isBoolOpen}
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
            isExpanded={isBoolOpen}
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
        id="typeahead-select"
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
