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
  getSpinnerRow,
  resultToClassificationRow,
} from '../utilities';
import { OPERATIONS } from '../constants';
import {
  FilterTable,
  MultiClassificationDropdown,
} from './index';


export class ClassifyFailuresTable extends React.Component {
  static propTypes = {
    filters: PropTypes.object
  };

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
      includeSkipped: false,
      filters: Object.assign({'result': {op: 'in', val: 'failed;error'}}, props.filters),
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
    rows[rowIndex].isOpen = isOpen;
    this.setState({
      rows
    });
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
      this.refreshResults();
    })
  };

  removeFilter = id => {
    if (id === "metadata.exception_name") {   // only remove exception_name filter
      this.updateFilters(id, null, null, () => {
        this.setState({page: 1}, this.refreshResults);
      });
    }
  }

  onSkipCheck = (checked) => {
    let { filters } = this.state;
    if (checked) {
      filters["result"]["val"] += ";skipped;xfailed"
    }
    else {
      filters["result"]["val"] = "failed;error"
    }
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
    params['filter'] = [];
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;
    // Convert UI filters to API filters
    for (let key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && !!filters[key]) {
        let val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        params.filter.push(key + op + val);
      }
    }

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
    const { columns, rows, selectedResults, includeSkipped } = this.state;
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
            onRemoveFilter={this.removeFilter}
          />
        </CardBody>
      </Card>
    );
  }

}
