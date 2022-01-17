import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Flex,
  FlexItem,
  TextContent,
  Text,
} from '@patternfly/react-core';
import {
  TableVariant,
  expandable
} from '@patternfly/react-table';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildParams,
  toAPIFilter,
  getSpinnerRow,
  resultToClassificationRow,
} from '../utilities';
import { FILTERABLE_RESULT_FIELDS } from '../constants';
import {
  FilterTable,
  MultiClassificationDropdown,
  MetaFilter,
  ResultView
} from './index';


export class ClassifyFailuresTable extends React.Component {
  static propTypes = {
    filters: PropTypes.object,
    run_id: PropTypes.string
  }

  constructor(props) {
    super(props);
    this.state = {
      columns: [{title: 'Test', cellFormatters: [expandable]}, 'Result', 'Exception Name', 'Classification', 'Duration'],
      rows: [getSpinnerRow(5)],
      results: [],
      selectedResults: [],
      cursor: null,
      pageSize: 10,
      page: 1,
      totalItems: 0,
      totalPages: 0,
      isEmpty: false,
      isError: false,
      isFieldOpen: false,
      isOperationOpen: false,
      includeSkipped: false,
      filters: Object.assign({
        'result': {op: 'in', val: 'failed;error'},
        'run_id': {op: 'eq', val: props.run_id}}, props.filters),
    };
    this.refreshResults = this.refreshResults.bind(this);
    this.onCollapse = this.onCollapse.bind(this);
  }

  refreshResults = () => {
    this.setState({selectedResults: []});
    this.getResultsForTable();
  }

  onCollapse(event, rowIndex, isOpen) {
    const { rows } = this.state;

    // lazy-load the result view so we don't have to make a bunch of artifact requests
    if (isOpen) {
      let result = rows[rowIndex].result;
      let hideSummary=true;
      let hideTestObject=true;
      let defaultTab="test-history";
      if (result.result === "skipped") {
        hideSummary=false;
        hideTestObject=false;
        defaultTab="summary";
      }
      rows[rowIndex + 1].cells = [{
        title: <ResultView defaultTab={defaultTab} hideTestHistory={false} hideSummary={hideSummary} hideTestObject={hideTestObject} testResult={rows[rowIndex].result}/>
      }]
    }
    rows[rowIndex].isOpen = isOpen;
    this.setState({rows});
  }

  onTableRowSelect = (event, isSelected, rowId) => {
    let rows;
    if (rowId === -1) {
      rows = this.state.rows.map(oneRow => {
        oneRow.selected = isSelected;
        return oneRow;
      });
    }
    else {
      rows = [...this.state.rows];
      rows[rowId].selected = isSelected;
    }
    this.setState({
      rows,
    });
    this.getSelectedResults();
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.getResultsForTable();
    });
  }

  pageSizeSelect = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.getResultsForTable();
    });
  }

  updateFilters(name, operator, value, callback) {
    let filters = this.state.filters;
    if ((value === null) || (value.length === 0)) {
      delete filters[name];
    }
    else {
      filters[name] = {'op': operator, 'val': value};
    }
    this.setState({filters: filters, page: 1}, callback);
  }

  setFilter = (field, value) => {
    // maybe process values array to string format here instead of expecting caller to do it?
    let operator = (value.includes(";")) ? 'in' : 'eq'
    this.updateFilters(field, operator, value, this.refreshResults)
  }

  removeFilter = id => {
    if ((id !== "result") && (id !== "run_id")) {   // Don't allow removal of error/failure filter
      this.updateFilters(id, null, null, this.refreshResults)
    }
  }

  onSkipCheck = (checked) => {
    let { filters } = this.state;
    filters["result"]["val"] = ("failed;error") + ((checked) ? ";skipped;xfailed" : "")
    this.setState(
      {includeSkipped: checked, filters},
      this.refreshResults
    );
  }

  getSelectedResults = () => {
    const { results, rows } = this.state;
    let selectedResults = [];
    for (const [index, row] of rows.entries()) {
      if (row.selected && row.parent == null) {  // rows with a parent attr are the child rows
        selectedResults.push(results[index / 2]);  // divide by 2 to convert row index to result index
      }
    }
    this.setState({selectedResults});
  }

  getResultsForTable() {
    const filters = this.state.filters;
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    // get only failed results
    let params = buildParams(filters);
    params['filter'] = toAPIFilter(filters);
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;

    this.setState({rows: [['Loading...', '', '', '', '']]});
    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
          results: data.results,
          rows: data.results.map((result, index) => resultToClassificationRow(result, index, this.setFilter)).flat(),
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          totalItems: data.pagination.totalItems,
          totalPages: data.pagination.totalPages,
          isEmpty: data.pagination.totalItems === 0,
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  componentDidMount() {
    this.getResultsForTable();
  }

  render() {
    const {
      columns,
      rows,
      selectedResults,
      includeSkipped,
      filters
    } = this.state;
    const { run_id } = this.props
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    }
    // filters for the metadata
    const resultFilters = [
      <MetaFilter
        key="metafilter"
        // user_properties fields shouldn't be injected here
        fieldOptions={FILTERABLE_RESULT_FIELDS}
        runId={run_id}
        setFilter={this.setFilter}
        customFilters={{'result': filters['result']}}
      />,
    ]
    return (
      <Card className="pf-u-mt-lg">
        <CardHeader>
          <Flex style={{ width: '100%' }}>
            <FlexItem grow={{ default: 'grow' }}>
              <TextContent>
                <Text component="h2" className="pf-c-title pf-m-xl">Test Failures</Text>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <TextContent>
                <Checkbox id="include-skips" label="Include skips, xfails" isChecked={includeSkipped} aria-label="include-skips-checkbox" onChange={this.onSkipCheck}/>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <MultiClassificationDropdown selectedResults={selectedResults} refreshFunc={this.refreshResults}/>
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" onClick={this.refreshResults}>Refresh results</Button>
            </FlexItem>
          </Flex>
        </CardHeader>
        <CardBody>
          <FilterTable
            columns={columns}
            rows={rows}
            pagination={pagination}
            isEmpty={this.state.isEmpty}
            isError={this.state.isError}
            onCollapse={this.onCollapse}
            onSetPage={this.setPage}
            onSetPageSize={this.pageSizeSelect}
            canSelectAll={true}
            onRowSelect={this.onTableRowSelect}
            variant={TableVariant.compact}
            activeFilters={this.state.filters}
            filters={resultFilters}
            onRemoveFilter={this.removeFilter}
            hideFilters={["run_id", "project_id"]}
          />
        </CardBody>
      </Card>
    );
  }

}
