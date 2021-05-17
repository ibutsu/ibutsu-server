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

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildParams,
  getActiveProject,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter,
  resultToRow
} from './utilities';
import { MultiValueInput, FilterTable } from './components';
import { DEFAULT_RUNS, OPERATIONS, RESULT_FIELDS } from './constants';

export class ResultList extends React.Component {
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
      columns: ['Test', 'Run', 'Result', 'Duration', 'Started'],
      rows: [getSpinnerRow(5)],
      runs: [],
      filteredRuns: DEFAULT_RUNS,
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      filters: filters,
      fieldSelection: null,
      fieldOptions: RESULT_FIELDS,
      isFieldOpen: false,
      operationSelection: 'eq',
      isOperationOpen: false,
      textFilter: '',
      runSelection: null,
      isRunOpen: false,
      resultSelection: null,
      isResultOpen: false,
      boolSelection: null,
      isBoolOpen: false,
      isError: false,
      isEmpty: false,
      inValues: []
    };
    props.eventEmitter.on('projectChange', () => {
      this.getResults();
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
      resultSelection: null,
      runSelection: null,
      boolSelection: null,
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

  onRunToggle = isExpanded => {
    this.setState({isRunOpen: isExpanded});
  };

  onRunSelect = (event, selection) => {
    const operationMode = getOperationMode(this.state.operationSelection);
    if (operationMode !== 'multi') {
      this.setState({
        runSelection: selection,
        isRunOpen: false
      });
    }
    else {
      const runSelection = this.state.runSelection || [];
      if (runSelection.includes(selection)) {
        this.setState({runSelection: runSelection.filter(item => item !== selection)});
      }
      else {
       this.setState({runSelection: [...runSelection, selection]});
      }
    }
  };

  onRunClear = () => {
    this.setState({
      runSelection: null,
      isRunOpen: false
    });
  };

  onRunFilter = (event) => {
    const filteredRuns = this.state.runs.filter((run) => run.startsWith(event.target.value));
    this.setState({filteredRuns});
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

  onResultToggle = isExpanded => {
    this.setState({isResultOpen: isExpanded});
  };

  onResultSelect = (event, selection) => {
    const operationMode = getOperationMode(this.state.operationSelection);
    if (operationMode !== 'multi') {
      this.setState({
        resultSelection: selection,
        isResultOpen: false
      });
    }
    else {
      const resultSelection = this.state.resultSelection || [];
      if (resultSelection.includes(selection)) {
        this.setState({resultSelection: resultSelection.filter(item => item !== selection)});
      }
      else {
        this.setState({resultSelection: [...resultSelection, selection]});
      }
    }
  };

  onResultClear = () => {
    this.setState({
      resultSelection: null,
      isResultOpen: false
    });
  };

  onInValuesChange = (values) => {
    this.setState({inValues: values});
  }

  applyFilter = () => {
    const field = this.state.fieldSelection;
    const operator = this.state.operationSelection;
    const filterMode = getFilterMode(field);
    const operationMode = getOperationMode(operator);
    let value = this.state.textFilter;
    if (filterMode === 'result' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? this.state.resultSelection.join(';') : this.state.resultSelection;
    }
    else if (filterMode === 'run' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? this.state.runSelection.join(';') : this.state.runSelection;
    }
    else if (operationMode === 'multi') {
      value = this.state.inValues.join(";");  // translate list to ;-separated string for BE
    }
    else if (operationMode === 'bool') {
      value = this.state.boolSelection;
    }
    this.updateFilters(field, operator, value, () => {
      this.updateUrl();
      this.getResults();
      this.setState({
        fieldSelection: null,
        operationSelection: 'eq',
        textFilter: '',
        resultSelection: null,
        runSelection: null,
        boolSelection: null,
        inValues: []
      });
    });
  };

  applyReport = () => {
    this.props.history.replace('/reports?' + buildParams(this.state.filters).join('&'));
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
      this.getResults();
      this.setState({
        fieldSelection: null,
        operationSelection: 'eq',
        textFilter: '',
        resultSelection: null,
        runSelection: null,
        boolSelection: null,
        inValues: []
      });
    });
  }

  removeFilter = id => {
    this.updateFilters(id, null, null, () => {
      this.updateUrl();
      this.setState({page: 1}, this.getResults);
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
      resultSelection: null,
      runSelection: null,
      boolSelection: null,
      inValues: []
    }, function () {
      this.updateUrl();
      this.getResults();
    });
  };

  updateUrl() {
    let params = buildParams(this.state.filters);
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.history.replace('/results?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
      this.getResults();
    });
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
      this.getResults();
    });
  }

  getResults() {
    // Show a spinner
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
    params['estimate'] = true;  // use a count estimate for this page
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
    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.results.map((result) => resultToRow(result, this.setFilter)),
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  getRuns() {
    HttpClient.get([Settings.serverUrl, 'run'], {pageSize: 500, estimate: true})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        const runs = data.runs.map((run) => run.id);
        this.setState({runs: runs, filteredRuns: runs});
      });
  }

  componentDidMount() {
    this.getResults();
    this.getRuns();
  }

  render() {
    document.title = 'Test Results | Ibutsu';
    const {
      columns,
      rows,
      filteredRuns,
      fieldSelection,
      isFieldOpen,
      fieldOptions,
      operationSelection,
      isOperationOpen,
      textFilter,
      runSelection,
      isRunOpen,
      resultSelection,
      isResultOpen,
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
        {(filterMode === 'text' && operationMode === 'multi') &&
          <MultiValueInput onValuesChange={this.onInValuesChange} style={{height: "inherit"}}/>
        }
        {(filterMode === 'run' && operationMode !== 'bool') &&
          <Select
            aria-label="Select a run"
            placeholderText="Select a run"
            variant={operationMode === 'multi' ? SelectVariant.typeaheadMulti : SelectVariant.typeahead}
            isOpen={isRunOpen}
            selections={runSelection}
            maxHeight={"1140%"}
            onToggle={this.onRunToggle}
            onSelect={this.onRunSelect}
            onClear={this.onRunClear}
            onFilter={this.onRunFilter}
          >
            {filteredRuns.map((option, index) => (
              <SelectOption key={index} value={option} isDisabled={option === DEFAULT_RUNS[0]} />
            ))}
          </Select>
        }
        {(filterMode === 'result' && operationMode !== 'bool') &&
          <Select
            aria-label="Select a result"
            placeholderText="Select a result"
            variant={operationMode === 'multi' ? SelectVariant.typeaheadMulti : SelectVariant.single}
            isOpen={isResultOpen}
            selections={resultSelection}
            onToggle={this.onResultToggle}
            onSelect={this.onResultSelect}
          >
            {["passed", "xpassed", "failed", "xfailed", "skipped", "error"].map((option, index) => (
              <SelectOption key={index} value={option} />
            ))}
          </Select>
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
            <Text className="title" component="h1">Test results</Text>
          </TextContent>
        </PageSection>
        <PageSection className="pf-u-pb-0">
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
                onApplyReport={this.applyReport}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
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
