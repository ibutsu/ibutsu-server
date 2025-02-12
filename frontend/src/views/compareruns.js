import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  TextContent,
  Checkbox,
  Button,
  Text
} from '@patternfly/react-core';
import {
  TableVariant,
  expandable
} from '@patternfly/react-table';

import { FilterTable, MetaFilter } from '../components/filtertable';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  toAPIFilter,
  getSpinnerRow,
  resultToComparisonRow
} from '../utilities';
import { IbutsuContext } from '../services/context';
import ResultView from '../components/result';

export class CompareRunsView extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    location: PropTypes.object,
    view: PropTypes.object
  };

  constructor(props) {
    super(props)
    this.state = {
      columns: [{title: 'Test', cellFormatters: [expandable]}, 'Run 1', 'Run 2'],
      rows: [getSpinnerRow(3)],
      results: [],
      selectedResults: [],
      cursor: null,
      pageSize: 0,
      page: 1,
      totalItems: 0,
      totalPages: 0,
      isEmpty: false,
      isError: false,
      includeSkipped: false,
      isLoading: false,
      filters: [Object.assign({
        'result': {op: 'in', val: 'failed;error;passed'},
        'id': 0
        }),
        Object.assign({
          'result': {op: 'in', val: 'failed;error;passed'},
          'id': 1
        })],
      loadingProps: {}
    }
    this.refreshResults = this.refreshResults.bind(this);
    this.onCollapse = this.onCollapse.bind(this);
  }

  onSkipCheck = (checked) => {
    let filters = this.state.filters;
    filters.forEach(filter => {
      filter['result']['val'] = ('failed;error;passed') + ((checked) ? ';skipped;xfailed' : '')
    });

    this.setState(
      {includeSkipped: checked, filters},
      this.refreshResults
    );
  }

  setFilter = (filterId, field, value) => {
    // maybe process values array to string format here instead of expecting caller to do it?
    let operator = (value.includes(';')) ? 'in' : 'eq';
    this.updateFilters(filterId, field, operator, value)
  }

  updateFilters(filterId, name, operator, value) {
    let newFilters = this.state.filters.map((filter) => {
      if (filter.id === filterId) {
        if ((value === null) || (value.length === 0)) {
          delete filter[name];
        }
        else {
          filter[name] = {'op': operator, 'val': String(value)};
        }
      }
      return filter
    });
    this.setState({filters: newFilters, page: 1});
  }

  removeFilter = (filterId, id) => {
    if ((id !== 'result') && (id !== 'run_id')) {   // Don't allow removal of error/failure filter
      this.updateFilters(filterId, id, null, null)
    }
  }

  getResultsForTable() {
    const filter = this.state.filters;

    // Check to see if filters have been set besides id and result
    let isNew = false;
    filter.forEach(filter => {
      for (const prop in filter) {
        if (prop !== 'id' && prop !== 'result') {
          isNew = true;
        }
      }
    })

    // Add loading animations to button and table
    this.setState({rows: [getSpinnerRow(3)], isEmpty: false, isError: false});
    this.setState({rows: [['Loading...', '', '']]});
    this.setState({
      loadingProps: {
        'spinnerAriaValueText': 'Loading',
        'spinnerAriaLabelledBy': 'primary-loading-button',
        'isLoading': true
      },
      isLoading: true
    })

    if (isNew === true) {
      // Add project id to params
      const { primaryObject } = this.context;
      const projectId = primaryObject ? primaryObject.id : ''
      filter.forEach(filter => {
        filter['project_id'] = {op: 'in', val: projectId};
      });

      // Build params and filters for each MetaFilter
      let apiFilters = [];
      filter.forEach(filter => {
        apiFilters.push(toAPIFilter(filter));
      })
      let params = [];
      params['filters'] = apiFilters;

      // Retrieve results from database
      HttpClient.get([Settings.serverUrl, 'widget', 'compare-runs-view'], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => this.setState({
            results: data.results,
            rows: data.results.map((result, index) => resultToComparisonRow(result, index)).flat(),
            totalItems: data.pagination.totalItems,
            pageSize: data.pagination.totalItems,
            isEmpty: data.pagination.totalItems === 0,
            loadingProps: {},
            isLoading: false
        }))
        .catch((error) => {
          console.error('Error fetching result data:', error);
          this.setState({rows: [], isEmpty: false, isError: true});
          this.setState({loadingProps: {}});
          this.setState({isLoading: false});
        });
    } else {
      this.setState({rows: [['No filters set.', '', '']]});
      this.setState({loadingProps: {}});
      this.setState({isLoading: false});
    }
  }

  onCollapse(event, rowIndex, isOpen) {
    const { rows } = this.state;

    // lazy-load the result view so we don't have to make a bunch of artifact requests
    if (isOpen) {
      let result = rows[rowIndex].result;
      let hideSummary=true;
      let hideTestObject=true;
      let defaultTab='test-history';
      if (result.result === 'skipped') {
        hideSummary=false;
        hideTestObject=false;
      }
      rows[rowIndex + 1].cells = [{
        title: <ResultView hideArtifact={true} comparisonResults={result} defaultTab={defaultTab} hideTestHistory={false} hideSummary={hideSummary} hideTestObject={hideTestObject} testResult={result[0]}/>
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

  refreshResults = () => {
    this.setState({selectedResults: []});
    this.getResultsForTable();
  }

  // Remove all active filters and clear table
  clearFilters = () => {
    this.setState({
      filters: [Object.assign({
      'result': {op: 'in', val: 'failed;error;passed'},
      'id': 0
      }),
      Object.assign({
        'result': {op: 'in', val: 'failed;error;passed'},
        'id': 1
      })],
      page: 1,
      totalItems: 0,
      totalPages: 0},
      this.getResultsForTable
    );

  }

  componentDidMount() {
    this.getResultsForTable();
  }

  render() {
    const {
      columns,
      rows,
      filters,
      includeSkipped
    } = this.state;

    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    }

    const resultFilters = [
      <Flex key="metafilters" direction={{default: 'column'}} spaceItems={{default: 'spaceItemsMd'}}>
        <FlexItem key="metafilter1">
          <TextContent style={{ fontWeight: 'bold' }}>
            Run 1:
          </TextContent>
          <MetaFilter
            setFilter={this.setFilter}
            customFilters={{'result': filters['result']}}
            activeFilters={this.state.filters[0]}
            onRemoveFilter={this.removeFilter}
            hideFilters={['run_id', 'project_id', 'id']}
            id={0}
          />
        </FlexItem>
        <FlexItem key="metafilter2">
          <TextContent style={{ fontWeight: 'bold' }}>
            Run 2:
          </TextContent>
          <MetaFilter
            setFilter={this.setFilter}
            customFilters={{'result': filters['result']}}
            activeFilters={this.state.filters[1]}
            onRemoveFilter={this.removeFilter}
            hideFilters={['run_id', 'project_id', 'id']}
            id={1}
          />
        </FlexItem>
      </Flex>
    ]
    const { primaryObject } = this.context;
    // Compare runs work only when project is selected
    return ( primaryObject &&
      <Card>
        <CardHeader>
          <Flex style={{ width: '100%' }}>
            <FlexItem grow={{ default: 'grow' }}>
              <TextContent>
                <Text component="h2" className="pf-v5-c-title pf-m-xl">Select Test Run metadata to compare</Text>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <TextContent>
                <Checkbox id="include-skips" label="Include skips, xfails" isChecked={includeSkipped} aria-label="include-skips-checkbox" onChange={(_event, checked) => this.onSkipCheck(checked)}/>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" onClick={this.refreshResults} {...this.state.loadingProps}>
                {this.state.isLoading ? 'Loading Results' : 'Apply Filters'}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" onClick={this.clearFilters} isDanger>Clear Filters</Button>
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
            canSelectAll={false}
            variant={TableVariant.compact}
            filters={resultFilters}
            onRemoveFilter={this.removeFilter}
            hideFilters={['project_id']}
          />
        </CardBody>
      </Card>
    );
  }
}
