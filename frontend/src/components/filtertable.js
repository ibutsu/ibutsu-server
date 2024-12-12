import React from 'react';
import PropTypes from 'prop-types';

import {
  Badge,
  Button,
  Chip,
  ChipGroup,
  Flex,
  FlexItem,
  Pagination,
  PaginationVariant
} from '@patternfly/react-core';
import {
  Select,
  SelectOption,
  SelectVariant
} from '@patternfly/react-core/deprecated';
import {
  Table,
  TableBody,
  TableHeader
} from '@patternfly/react-table/deprecated';

import { Settings } from '../settings';
import { HttpClient } from '../services/http';
import { toAPIFilter } from '../utilities';

import { TableEmptyState, TableErrorState } from './tablestates';
import { IbutsuContext } from '../services/context';

export class FilterTable extends React.Component {
  static propTypes = {
    columns: PropTypes.array,
    rows: PropTypes.array,
    actions: PropTypes.array,
    filters: PropTypes.array,
    activeFilters: PropTypes.object,
    hideFilters: PropTypes.array,
    pagination: PropTypes.object,
    isEmpty: PropTypes.bool,
    isError: PropTypes.bool,
    canSelectAll: PropTypes.bool,
    onApplyFilter: PropTypes.func,
    onCollapse: PropTypes.func,
    onRemoveFilter: PropTypes.func,
    onClearFilters: PropTypes.func,
    onApplyReport: PropTypes.func,
    onSetPage: PropTypes.func,
    onSetPageSize: PropTypes.func,
    onRowSelect: PropTypes.func,
    variant: PropTypes.node
  };

  render() {
    const {
      isEmpty,
      isError,
      onCollapse,
      onRowSelect,
      onApplyFilter,
      onRemoveFilter,
      onClearFilters,
      onApplyReport,
      onSetPage,
      onSetPageSize,
      variant
    } = this.props;
    let columns = this.props.columns || [];
    let rows = this.props.rows || [];
    let actions = this.props.actions || [];
    let filters = this.props.filters || [];
    let hideFilters = this.props.hideFilters || [];
    let activeFilters = this.props.activeFilters || {};
    let pagination = this.props.pagination || {page: 0, pageSize: 0, totalItems: 0};
    let canSelectAll = this.props.canSelectAll || false;
    return (
      <React.Fragment>
        <Flex>
          {(filters || onApplyFilter) &&
          <Flex spaceItems={{default: 'spaceItemsXs'}} grow={{default: 'grow'}}>
            {filters && filters.map((filter, index) => (
                <FlexItem key={index}>{filter}</FlexItem>
              ))}
            {onApplyFilter &&
            <FlexItem>
              <Button onClick={onApplyFilter}>Apply Filter</Button>
            </FlexItem>
            }
          </Flex>
          }
          <Flex alignSelf={{default: 'alignSelfFlexEnd'}} direction={{default: 'column'}} align={{default: 'alignRight'}}>
            <FlexItem>
              <Pagination
                perPage={pagination.pageSize}
                page={pagination.page}
                variant={PaginationVariant.top}
                itemCount={pagination.totalItems}
                onSetPage={onSetPage}
                onPerPageSelect={onSetPageSize}
                isCompact
              />
            </FlexItem>
          </Flex>
        </Flex>
        {Object.keys(activeFilters).length > 0 &&
        <Flex style={{marginTop: '1rem'}}>
          <Flex>
            <FlexItem>
              Active filters
            </FlexItem>
          </Flex>
          <Flex grow={{default: 'grow'}}>
            {Object.keys(activeFilters).map(key => (
            <FlexItem spacer={{ default: 'spacerXs'}} key={key}>
              {!hideFilters.includes(key) &&
              <ChipGroup categoryName={key}>
                <Chip badge={<Badge isRead={true}>{activeFilters[key]['op']}</Badge>} onClick={() => onRemoveFilter(key)}>
                  {(typeof activeFilters[key] === 'object') &&
                    <React.Fragment>
                      {activeFilters[key]['val']}
                    </React.Fragment>
                  }
                  {(typeof activeFilters[key] !== 'object') && activeFilters[key]}
                </Chip>
              </ChipGroup>
              }
            </FlexItem>
            ))}
          </Flex>
          {onApplyReport &&
          <Flex>
            <FlexItem style={{marginLeft: '0.75em'}}>
              <Button onClick={onApplyReport} variant="secondary">Use Active Filters in Report</Button>
            </FlexItem>
          </Flex>
          }
        </Flex>
        }
        <Table
          cells={columns}
          rows={rows}
          actions={actions}
          aria-label="List"
          canSelectAll={canSelectAll}
          onCollapse={onCollapse}
          onSelect={onRowSelect}
          variant={variant}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {isEmpty && <TableEmptyState onClearFilters={onClearFilters} />}
        {isError && <TableErrorState onClearFilters={onClearFilters} />}
        <Pagination
          widgetId="pagination-options-menu-bottom"
          perPage={pagination.pageSize}
          page={pagination.page}
          variant={PaginationVariant.top}
          itemCount={pagination.totalItems}
          dropDirection="up"
          onSetPage={onSetPage}
          onPerPageSelect={onSetPageSize}
          style={{marginTop: '1rem'}}
        />
      </React.Fragment>
    );
  }
}


// TODO Extend this to contain the filter handling functions, and better integrate filter state
// with FilterTable. See https://github.com/ibutsu/ibutsu-server/issues/230
export class MetaFilter extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    runId: PropTypes.string,
    setFilter: PropTypes.func,
    customFilters: PropTypes.object, // more advanced handling of filter objects? the results-aggregator endpoint takes a string filter
    onRemoveFilter: PropTypes.func,
    onApplyReport: PropTypes.func,
    hideFilters: PropTypes.array,
    activeFilters: PropTypes.object,
    id: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.state = {
      fieldSelection: [],
      isFieldOpen: false,
      isValueOpen: false,
      valueOptions: [],
      valueSelections: [],
      fieldOptions: []
    };
  }

  onFieldToggle = isExpanded => {
    this.setState({isFieldOpen: isExpanded})
  };

  onValueToggle = isExpanded => {
    this.setState({isValueOpen: isExpanded})
  };

  onFieldSelect = (event, selection) => {
    // clear value state too, otherwise the old selection remains selected but is no longer visible
    this.setState(
      {
        fieldSelection: selection,
        isFieldOpen: false,
        valueSelections: [],
        valueOptions: [],
        isValueOpen: false
      },
      this.updateValueOptions
    );
  };

  onValueSelect = (event, selection) => {
    // update state and call setFilter
    const valueSelections = this.state.valueSelections;
    let updatedValues = (valueSelections.includes(selection))
      ? valueSelections.filter(item => item !== selection)
      : [...valueSelections, selection]

    this.setState(
      {valueSelections: updatedValues},
      () => this.props.setFilter(this.props.id, this.state.fieldSelection, this.state.valueSelections.join(';'))
    )
  };

  onFieldClear = () => {
    this.setState({
      fieldSelection: [],
      isFieldOpen: false,
      isValueOpen: false,
      valueOptions: [],
      valueSelections: [],
    });
  };

  onValueClear = () => {
    this.setState(
      {valueSelections: [], isValueOpen: false},
      () => this.props.setFilter(this, this.state.fieldSelection, this.state.valueSelections)
    )
  }

  updateValueOptions = () => {
    const { fieldSelection } = this.state;
    const customFilters = this.props.activeFilters;
    console.debug('CUSTOMFILTER: ' + customFilters);

    if (fieldSelection !== null) {
      let api_filter = toAPIFilter(customFilters).join();
      console.debug('APIFILTER: ' + customFilters);

      const { primaryObject } = this.context;
      let projectId = primaryObject ? primaryObject.id : ''

      // make runId optional
      let params = {}
      if (this.props.runId) {
        params = {
          group_field: fieldSelection,
          run_id: this.props.runId,
          additional_filters: api_filter,
          project: projectId
        }
      } else {
        params = {
          days: 30,
          project: projectId,
          group_field: fieldSelection,
          additional_filters: api_filter,
        }
      }

      HttpClient.get(
        [Settings.serverUrl, 'widget', 'result-aggregator'],
        params
      )
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({valueOptions: data})
      });
    }
  }

  getProjectFilterParams() {
    const { primaryObject } = this.context;
    HttpClient.get([Settings.serverUrl, 'project', 'filter-params', primaryObject.id])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({fieldOptions: data});
      });
  }

  componentDidMount() {
    this.getProjectFilterParams();
  }

  render () {
    const {
      isFieldOpen,
      fieldSelection,
      isValueOpen,
      valueOptions,
      valueSelections,
    } = this.state;
    const {
      onRemoveFilter,
      onApplyReport,
      id
    } = this.props;
    let hideFilters = this.props.hideFilters || [];
    let activeFilters = this.props.activeFilters || {};
    let field_selected = this.state.fieldSelection !== null;
    let values_available = valueOptions.length > 0;
    let value_placeholder = 'Select a field first' ; // default instead of an else block
    if (field_selected && values_available) {
      value_placeholder = 'Select value(s)';
    }
    else if (field_selected && !values_available) {
      value_placeholder = 'No values for selected field';
    }
    return (
      <React.Fragment>
        <Flex>
          <FlexItem>
            <Select key="metafield_select"
              aria-label="metadata-field-filter"
              placeholderText="Select metadata field"
              variant={SelectVariant.typeaheadMulti}
              isOpen={isFieldOpen}
              selections={fieldSelection}
              maxHeight="1140%"
              onToggle={(_event, isExpanded) => this.onFieldToggle(isExpanded)}
              onSelect={this.onFieldSelect}
              onClear={this.onFieldClear}
              isCreatable={true}
            >
              {this.state.fieldOptions.map((option, index) => (
                <SelectOption key={index} value={option}/>
              ))}
            </Select>
            <Select key="metavalue_select"
              typeAheadAriaLabel={value_placeholder}
              placeholderText={value_placeholder}
              variant={SelectVariant.typeaheadMulti}
              isOpen={isValueOpen}
              selections={valueSelections}
              maxHeight="1140%"
              isDisabled={!field_selected || (field_selected && !values_available) }
              onToggle={(_event, isExpanded) => this.onValueToggle(isExpanded)}
              onSelect={this.onValueSelect}
              onClear={this.onValueClear}
            >
              {valueOptions.map((option, index) => (
                <SelectOption key={index} value={option._id} description={option.count + ' results'}/>
              ))}
            </Select>
          </FlexItem>
        </Flex>
        {Object.keys(activeFilters).length > 0 &&
        <Flex style={{marginTop: '1rem', fontWeight: 'normal'}}>
          <Flex>
            <FlexItem style={{marginBottom: '0.5rem'}}>
              Active filters
            </FlexItem>
          </Flex>
          <Flex grow={{default: 'grow'}}>
            {Object.keys(activeFilters).map(key => (
            <FlexItem style={{marginBottom: '0.5rem'}} spacer={{ default: 'spacerXs'}} key={key}>
              {!hideFilters.includes(key) &&
              <ChipGroup categoryName={key}>
                <Chip badge={<Badge isRead={true}>{activeFilters[key]['op']}</Badge>} onClick={() => onRemoveFilter(id, key)}>
                  {(typeof activeFilters[key] === 'object') &&
                    <React.Fragment>
                      {activeFilters[key]['val']}
                    </React.Fragment>
                  }
                  {(typeof activeFilters[key] !== 'object') && activeFilters[key]}
                </Chip>
              </ChipGroup>
              }
            </FlexItem>
            ))}
          </Flex>
          {onApplyReport &&
          <Flex>
            <FlexItem style={{marginLeft: '0.75em'}}>
              <Button onClick={onApplyReport} variant="secondary">Use Active Filters in Report</Button>
            </FlexItem>
          </Flex>
          }
        </Flex>
        }
      </React.Fragment>
    );
  }
}
