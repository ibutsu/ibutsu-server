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
  PaginationVariant,
  Select,
  SelectOption,
  SelectVariant,
} from '@patternfly/react-core';
import {
  Table,
  TableBody,
  TableHeader
} from '@patternfly/react-table';

import { Settings } from '../settings';
import { HttpClient } from '../services/http';
import { toAPIFilter } from '../utilities';

import { TableEmptyState, TableErrorState } from './tablestates';

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
            {filters && filters.map((filter, index) => {
              return (
                <FlexItem key={index}>{filter}</FlexItem>
              );
            })}
            {onApplyFilter &&
            <FlexItem>
              <Button onClick={onApplyFilter}>Apply Filter</Button>
            </FlexItem>
            }
          </Flex>
          }
          <Flex align={{default: 'alignRight'}}>
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
        <Flex style={{marginTop: "1rem"}}>
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
                <Chip onClick={() => onRemoveFilter(key)}>
                  {(typeof activeFilters[key] === 'object') &&
                    <React.Fragment>
                      <Badge isRead={true}>{activeFilters[key]['op']}</Badge>
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
            <FlexItem style={{marginLeft: "0.75em"}}>
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
          variant={PaginationVariant.bottom}
          itemCount={pagination.totalItems}
          dropDirection="up"
          onSetPage={onSetPage}
          onPerPageSelect={onSetPageSize}
          style={{marginTop: "1rem"}}
        />
      </React.Fragment>
    );
  }
}


export class MetaFilter extends React.Component {
  // TODO Extend this to contain the filter handling functions, and better integrate filter state with FilterTable
  // https://github.com/ibutsu/ibutsu-server/issues/230
  static propTypes = {
    fieldOptions: PropTypes.array,  // could reference constants directly
    runId: PropTypes.string,  // make optional?
    setFilter: PropTypes.func,
    customFilters: PropTypes.array, // more advanced handling of filter objects? the results-aggregator endpoint takes a string filter
  };

  constructor(props) {
    super(props);
    this.state = {
      fieldSelection: null,
      isFieldOpen: false,
      isValueOpen: false,
      valueOptions: [],
      valueSelections: [],
    };
  }

  onFieldToggle = isExpanded => {
    this.setState({isFieldOpen: isExpanded})
  };

  onValueToggle = isExpanded => {
    this.setState({isValueOpen: isExpanded})
  };

  onFieldSelect = (event, selection) => {
    this.setState(
      // clear value state too, otherwise the old selection remains selected but is no longer visible
      {fieldSelection: selection, isFieldOpen: false, valueSelections: [], valueOptions: [], isValueOpen: false},
      this.updateValueOptions
    )

  };

  onValueSelect = (event, selection) => {
    // update state and call setFilter
    const valueSelections = this.state.valueSelections;
    let updated_values = (valueSelections.includes(selection))
      ? valueSelections.filter(item => item !== selection)
      : [...valueSelections, selection]

    this.setState(
      {valueSelections: updated_values},
      () => this.props.setFilter(this.state.fieldSelection, this.state.valueSelections.join(';'))
    )
  };

  onFieldClear = () => {
    this.setState(
      {fieldSelection: null, valueSelections: [], isFieldOpen: false, isValueOpen: false},
    )
  };

  onValueClear = () => {
    this.setState(
      {valueSelections: [], isValueOpen: false},
      () => this.props.setFilter(this.state.fieldSelection, this.state.valueSelections)
    )
  }

  updateValueOptions = () => {
    const {fieldSelection} = this.state
    const {customFilters} = this.props

    console.log('CUSTOMFILTER: '+customFilters)
    if (fieldSelection !== null) {
      let api_filter = toAPIFilter(customFilters).join()
      console.log('APIFILTER: '+customFilters)

      HttpClient.get(
        [Settings.serverUrl, 'widget', 'result-aggregator'],
        {
          group_field: fieldSelection,
          run_id: this.props.runId,
          additional_filters: api_filter,
        }
      )
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({valueOptions: data})
      })
    }
  }

  render () {
    const {isFieldOpen, fieldSelection, isValueOpen, valueOptions, valueSelections} = this.state;
    let field_selected = this.state.fieldSelection !== null;
    let values_available = valueOptions.length > 0;
    let value_placeholder = "Select a field first" ; // default instead of an else block
    if (field_selected && values_available){ value_placeholder = "Select value(s)";}
    else if (field_selected && !values_available) { value_placeholder = "No values for selected field";}
    return (
      <React.Fragment>
        <Select key="metafield_select"
          aria-label="metadata-field-filter"
          placeholderText="Select metadata field"
          variant={SelectVariant.single}
          isOpen={isFieldOpen}
          selections={fieldSelection}
          maxHeight={"1140%"}
          onToggle={this.onFieldToggle}
          onSelect={this.onFieldSelect}
          onClear={this.onFieldClear}
        >
          {this.props.fieldOptions.map((option, index) => (
            <SelectOption key={index} value={option}/>
          ))}
        </Select>
        <Select key="metavalue_select"
          typeAheadAriaLabel={value_placeholder}
          placeholderText={value_placeholder}
          variant={SelectVariant.typeaheadMulti}
          isOpen={isValueOpen}
          selections={valueSelections}
          maxHeight={"1140%"}
          isDisabled={!field_selected || (field_selected && !values_available) }
          onToggle={this.onValueToggle}
          onSelect={this.onValueSelect}
          onClear={this.onValueClear}
        >
          {valueOptions.map((option, index) => (
            <SelectOption key={index} value={option._id} description={option.count + ' results'}/>
          ))}
        </Select>
      </React.Fragment>

    )
  }
}
