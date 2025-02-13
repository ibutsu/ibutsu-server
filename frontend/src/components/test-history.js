import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  MenuToggle,
  TextContent,
  Text
} from '@patternfly/react-core';
import {
  TableVariant,
  expandable
} from '@patternfly/react-table';
import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  buildParams,
  toAPIFilter,
  getSpinnerRow,
  resultToTestHistoryRow,
} from '../utilities';

import { FilterTable } from './filtertable';
import RunSummary from './runsummary';
import ResultView from './result';


export class TestHistoryTable extends React.Component {
  static propTypes = {
    filters: PropTypes.object,
    testResult: PropTypes.object,
    comparisonResults: PropTypes.array
  };

  constructor (props) {
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
      lastPassedDate: 'n/a',
      filters: Object.assign({
        'result': {op: 'in', val: 'passed;skipped;failed;error;xpassed;xfailed'},
        'test_id': {op: 'eq', val: props.testResult.test_id},
        'component': {op: 'eq', val: props.testResult.component},
        // default to filter only from 1 weeks ago to the most test's start_time.
        'start_time': {op: 'gt', val: new Date(new Date(props.testResult.start_time).getTime() - (0.25 * 30 * 86400 * 1000)).toISOString()}
      }, props.filters),
      comparisonResults: this.props.comparisonResults
    };
    // filter on env by default
    if (props.testResult.env) {
      this.state.filters['env'] = {op: 'eq', val: props.testResult.env};
    }
    this.refreshResults = this.refreshResults.bind(this);
    this.onCollapse = this.onCollapse.bind(this);
  }

  refreshResults = () => {
    this.getHistorySummary();
  };

  onCollapse (event, rowIndex, isOpen) {
    const { rows } = this.state;

    // lazy-load the result view so we don't have to make a bunch of artifact requests
    if (isOpen) {
      rows[rowIndex + 1].cells = [{
        title: <ResultView hideTestHistory={true} hideSummary={false} hideTestObject={false} testResult={rows[rowIndex].result}/>
      }];
    }
    rows[rowIndex].isOpen = isOpen;
    this.setState({rows});
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.getResultsForTable();
    });
  };

  pageSizeSelect = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.getResultsForTable();
    });
  };

  updateFilters (name, operator, value, callback) {
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
    let operator = (value.includes(';')) ? 'in' : 'eq';
    this.updateFilters(field, operator, value, this.refreshResults);
  };

  removeFilter = id => {
    if ((id !== 'result') && (id !== 'test_id')) {   // Don't allow removal of error/failure filter
      this.updateFilters(id, null, null, this.refreshResults);
    }
  };

  onFailuresCheck = (checked) => {
    let { filters } = this.state;
    filters['result']['val'] = ('failed;error') + ((checked) ? ';skipped;xfailed' : ';skipped;xfailed;xpassed;passed');
    this.setState(
      {onlyFailures: checked, filters},
      this.refreshResults
    );
  };

  onDropdownToggle = isOpen => {
    this.setState({isDropdownOpen: isOpen});
  };

  onDropdownSelect  = (_event, selection) => {
    let { filters } = this.state;
    let { testResult } = this.props;
    let startTime = new Date(testResult.start_time);
    // here a selection (month) is considered to be 30 days, and there are 86400*1000 ms in a day
    let timeRange = new Date(startTime.getTime() - (selection * 30 * 86400 * 1000));
    // set the filters
    filters['start_time'] = {op: 'gt', val: timeRange.toISOString()};
    this.setState({filters, isDropdownOpen: false, dropdownSelection: selection}, this.refreshResults);
  };

  getHistorySummary () {
    // get the passed/failed/etc test summary
    let filters = {...this.state.filters};
    // disregard result filter (we want all results)
    delete filters['result'];
    let api_filter = toAPIFilter(filters).join();
    let dataToSummary = Object.assign({
      'passed': 'passes',
      'failed': 'failures',
      'error': 'errors',
      'skipped': 'skips',
      'xfailed': 'xfailures',
      'xpassed': 'xpasses'
    });
    let summary = Object.assign({
      'passes': 0,
      'failures': 0,
      'errors': 0,
      'skips': 0,
      'xfailures': 0,
      'xpasses': 0
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
          summary[dataToSummary[item['_id']]] = item['count'];
        });
        this.setState({historySummary: summary}, this.getResultsForTable);
      });
  }

  getLastPassed (){
    // get the passed/failed/etc test summary
    let filters = {...this.state.filters};
    // disregard result filter so we can filter on last passed
    delete filters['result'];
    delete filters['start_time'];
    filters['result'] = {'op': 'eq', 'val': 'passed'};
    let params = buildParams(filters);
    params['filter'] = toAPIFilter(filters);
    params['pageSize'] = 1;
    params['page'] = 1;
    params['estimate'] = 'true';

    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        lastPassedDate:
            <React.Fragment>
              <Link target="_blank" rel="noopener noreferrer" to={`../results/${data.results[0].id}`} relative="Path">
                <Badge isRead>
                  {new Date(data.results[0].start_time).toLocaleString()}
                </Badge>
              </Link>
            </React.Fragment>
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({lastPassedDate: <Badge isRead>n/a</Badge>});
      });
  }

  getResultsForTable () {
    if (this.state.comparisonResults !== undefined) {
      this.setState({
        results: this.state.comparisonResults,
        rows: this.state.comparisonResults.map((result, index) => resultToTestHistoryRow(result, index, this.setFilter)).flat(),
      });
    } else {
      const filters = this.state.filters;
      this.setState({rows: [getSpinnerRow(4)], isEmpty: false, isError: false});
      let params = buildParams(filters);
      params['filter'] = toAPIFilter(filters);
      params['pageSize'] = this.state.pageSize;
      params['page'] = this.state.page;
      params['estimate'] = 'true';

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
        }))
        .catch((error) => {
          console.error('Error fetching result data:', error);
          this.setState({rows: [], isEmpty: false, isError: true});
        });
    }

  }

  componentDidMount () {
    this.getHistorySummary();
    this.getLastPassed();
  }

  render () {
    const {
      columns,
      rows,
      onlyFailures,
      historySummary,
      dropdownSelection,
    } = this.state;
    const dropdownValues = Object.assign({
      '1 Week': 0.25,
      '2 Weeks': 0.5,
      '1 Month': 1.0,
      '2 Months': 2.0,
      '3 Months': 3.0,
      '5 Months': 5.0
    });
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };

    return (
      <Card className="pf-u-mt-lg">
        <CardHeader>
          <Flex style={{ width: '100%' }}>
            <FlexItem grow={{ default: 'grow' }}>
              <TextContent>
                <Text component="h2" className="pf-v5-c-title pf-m-xl">
                  Test History
                </Text>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <TextContent>
                <Checkbox id="only-failures" label="Only show failures/errors" isChecked={onlyFailures} aria-label="only-failures-checkbox" onChange={(_event, checked) => this.onFailuresCheck(checked)}/>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <Dropdown
                isOpen={this.state.isDropdownOpen}
                onSelect={this.onDropdownSelect}
                onOpenChange={() => this.setState({isDropdownOpen: false})}
                toggle={toggleRef => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={this.onDropdownToggle}
                    isExpanded={this.state.isDropdownOpen}
                  >
                    Time range
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  {Object.keys(dropdownValues).map((key) => (
                    <DropdownItem key={key} value={dropdownValues[key]} autoFocus={key === dropdownSelection}>
                      {key}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </Dropdown>
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
            filters={[
              <Text key="summary" component="h4">
                Summary:&nbsp;
                {historySummary &&
                <RunSummary summary={historySummary}/>
                }
              </Text>,
              <Text key="last-passed" component="h4">Last passed:&nbsp;{this.state.lastPassedDate}</Text>,
            ]}
            onRemoveFilter={this.removeFilter}
            hideFilters={['project_id', 'result', 'test_id', 'component']}
          />
        </CardBody>
      </Card>
    );
  }

}
