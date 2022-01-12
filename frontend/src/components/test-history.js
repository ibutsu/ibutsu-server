import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  Flex,
  FlexItem,
  TextContent,
  Text,
  Tooltip
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
  resultToTestHistoryRow,
} from '../utilities';
import {
  FilterTable,
  ResultView,
  RunSummary
} from './index';


export class TestHistoryTable extends React.Component {
  static propTypes = {
    filters: PropTypes.object,
    testResult: PropTypes.object,
  }

  constructor(props) {
    super(props);
    this.state = {
      columns: [{title: 'Result', cellFormatters: [expandable]}, 'Source', 'Exception Name', 'Duration', 'Start Time'],
      rows: [getSpinnerRow(5)],
      results: [],
      cursor: null,
      pageSize: 10,
      page: 1,
      totalItems: 0,
      totalPages: 0,
      isEmpty: false,
      isError: false,
      isFieldOpen: false,
      isOperationOpen: false,
      isDropdownOpen: false,
      onlyFailures: false,
      historySummary: null,
      dropdownSelection: '1 Week',
      filters: Object.assign({
        'result': {op: 'in', val: "passed;skipped;failed;error;xpassed;xfailed"},
        'test_id': {op: 'eq', val: props.testResult.test_id},
        'env': {op: 'eq', val: props.testResult.env},
        // default to filter only from 1 weeks ago to the most test's start_time.
        'start_time': {op: 'gt', val: new Date(new Date(props.testResult.start_time).getTime() - (0.25 * 30 * 86400 * 1000)).toISOString()}
        }, props.filters),
    };
    this.refreshResults = this.refreshResults.bind(this);
    this.onCollapse = this.onCollapse.bind(this);
  }

  refreshResults = () => {
    this.getResultsForTable();
  }

  onCollapse(event, rowIndex, isOpen) {
    const { rows } = this.state;

    // lazy-load the result view so we don't have to make a bunch of artifact requests
    if (isOpen) {
      let result = rows[rowIndex].result;
      let hideSummary=true;
      let hideTestObject=true;
      if (["passed", "skipped"].includes(result.result)) {
        hideSummary=false;
        hideTestObject=false;
      }
      rows[rowIndex + 1].cells = [{
        title: <ResultView hideTestHistory={true} hideSummary={hideSummary} hideTestObject={hideTestObject} testResult={rows[rowIndex].result}/>
      }]
    }
    rows[rowIndex].isOpen = isOpen;
    this.setState({rows});
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
    if ((id !== "result") && (id !== "test_id")) {   // Don't allow removal of error/failure filter
      this.updateFilters(id, null, null, this.refreshResults)
    }
  }

  onFailuresCheck = (checked) => {
    let { filters } = this.state;
    filters["result"]["val"] = ("failed;error") + ((checked) ? ";skipped;xfailed" : ";skipped;xfailed;xpassed;passed")
    this.setState(
      {onlyFailures: checked, filters},
      this.refreshResults
    );
  }

  onDropdownToggle = isOpen => {
    this.setState({isDropdownOpen: isOpen});
  }

  onDropdownSelect = event => {
    let { filters } = this.state;
    let { testResult } = this.props;
    let startTime = new Date(testResult.start_time);
    let months = event.target.getAttribute('value');
    let selection = event.target.text
    // here a month is considered to be 30 days, and there are 86400*1000 ms in a day
    let timeRange = new Date(startTime.getTime() - (months * 30 * 86400 * 1000));
    // set the filters
    filters["start_time"] = {op: "gt", val: timeRange.toISOString()}
    this.setState({filters, isDropdownOpen: false, dropdownSelection: selection}, this.refreshResults);
  }

  getHistorySummary() {
    // get the passed/failed/etc test summary
    let filters = {... this.state.filters};
    // disregard result filter (we want all results)
    delete filters["result"];
    let api_filter = toAPIFilter(filters).join()
    let dataToSummary = Object.assign({
      'passed': 'passes',
      'failed': 'failures',
      'error': 'errors',
      'skipped': 'skips',
      'xfailed': 'xfailures',
      'xpassed': 'xpasses'
    })
    let summary = Object.assign({
      "passes": 0,
      "failures": 0,
      "errors": 0,
      "skips": 0,
      "xfailures": 0,
      "xpasses": 0
    });

    HttpClient.get(
      [Settings.serverUrl, 'widget', 'result-aggregator'],
        {
          group_field: 'result',
          additional_filters: api_filter,
        }
      )
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        data.forEach(item => {
          summary[dataToSummary[item['_id']]] = item['count']
        })
        this.setState({historySummary: summary})
      })
  }

  getResultsForTable() {
    const filters = this.state.filters;
    this.setState({rows: [getSpinnerRow(4)], isEmpty: false, isError: false});
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
          rows: data.results.map((result, index) => resultToTestHistoryRow(result, index, this.setFilter)).flat(),
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          totalItems: data.pagination.totalItems,
          totalPages: data.pagination.totalPages,
          isEmpty: data.pagination.totalItems === 0,
      }, this.getHistorySummary))
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
      onlyFailures,
      historySummary
    } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    }

    return (
      <Card className="pf-u-mt-lg">
        <CardHeader>
          <Flex style={{ width: '100%' }}>
            <FlexItem grow={{ default: 'grow' }}>
              <TextContent>
                <Text component="h3" className="pf-c-title pf-m-xl">
                  Test History
                  {historySummary &&
                  <RunSummary summary={historySummary}/>
                  }
                </Text>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <TextContent>
                <Checkbox id="only-failures" label="Only show failures/errors" isChecked={onlyFailures} aria-label="only-failures-checkbox" onChange={this.onFailuresCheck}/>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <Dropdown
                toggle={
                <Tooltip content={<div>Amount of time to gather results</div>}>
                  <DropdownToggle isDisabled={false} onToggle={this.onDropdownToggle}>{this.state.dropdownSelection}</DropdownToggle>
                </Tooltip>
                }
                onSelect={this.onDropdownSelect}
                isOpen={this.state.isDropdownOpen}
                dropdownItems={[
                  <DropdownItem key='1 Weeks' value={0.25}>{'1 Week'}</DropdownItem>,
                  <DropdownItem key='2 Weeks' value={0.5}>{'2 Weeks'}</DropdownItem>,
                  <DropdownItem key='1 Month' value={1.0}>{'1 Month'}</DropdownItem>,
                  <DropdownItem key='2 Months' value={2.0}>{'2 Months'}</DropdownItem>,
                  <DropdownItem key='3 Months' value={3.0}>{'3 Months'}</DropdownItem>,
                  <DropdownItem key='5 Months' value={5.0}>{'5 Months'}</DropdownItem>,
                ]}
              />
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
            canSelectAll={false}
            variant={TableVariant.compact}
            activeFilters={this.state.filters}
            onRemoveFilter={this.removeFilter}
            hideFilters={["project_id", "result", "test_id"]}
          />
        </CardBody>
      </Card>
    );
  }

}
