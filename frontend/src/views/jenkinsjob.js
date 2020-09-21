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
import { ChevronRightIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { Settings } from '../settings';
import {
  buildParams,
  buildUrl,
  getActiveProject,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter
} from '../utilities';
import { FilterTable, MultiValueInput, RunSummary } from '../components';
import { OPERATIONS, JJV_FIELDS } from '../constants';


function jobToRow(job, analysisViewId) {
  let start_time = new Date(job.start_time);
  return {
    cells: [
      analysisViewId ? {title: <Link to={`/view/${analysisViewId}?job_name=${job.job_name}`}>{job.job_name}</Link>} : job.job_name,
      {title: <a href={job.build_url} target="_blank" rel="noopener noreferrer">{job.build_number}</a>},
      {title: <RunSummary summary={job.summary} />},
      job.source,
      job.env,
      start_time.toLocaleString(),
      {title: <Link to={`/runs?metadata.jenkins.job_name[eq]=${job.job_name}&metadata.jenkins.build_number=${job.build_number}`}>See runs <ChevronRightIcon /></Link>}
    ]
  };
}

export class JenkinsJobView extends React.Component {
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
      columns: ['Job name', 'Build number', 'Summary', 'Source', 'Env', 'Started', ''],
      pagination: {page: page, pageSize: pageSize, totalItems: 0},
      filters: filters,
      isEmpty: true,
      isError: false,
      fieldSelection: null,
      fieldOptions: JJV_FIELDS,
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
    let analysisViewId = '';
    let filters = this.state.filters;
    let params = this.props.view.params;
    let project = getActiveProject();

    // get the widget ID for the analysis view
    fetch(buildUrl(Settings.serverUrl + '/widget-config', {"filter": "widget=jenkins-analysis-view"}))
      .then(response => response.json())
      .then(data => {
          analysisViewId = data.widgets[0].id
      }).catch(error => {
        console.log(error);
      });
    // Show a spinner
    this.setState({rows: [getSpinnerRow(7)], isEmpty: false, isError: false});
    if (!this.props.view) {
      return;
    }
    if (project) {
      params['project'] = project.id;
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
    fetch(buildUrl(Settings.serverUrl + '/widget/' + this.props.view.widget, params))
      .then(response => response.json())
      .then(data => {
        this.setState({
          rows: data.jobs.map(job => jobToRow(job, analysisViewId)),
          pagination: data.pagination
        });
      });
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
