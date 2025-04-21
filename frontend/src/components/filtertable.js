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
} from '@patternfly/react-core';

import {
  Table,
  TableBody,
  TableHeader,
} from '@patternfly/react-table/deprecated';

import { TableEmptyState, TableErrorState } from './tablestates';

const FilterTable = (props) => {
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
    variant,
  } = props;

  let columns = props.columns || [];
  let rows = props.rows || [];
  let actions = props.actions || [];
  let filters = props.filters || [];
  let hideFilters = props.hideFilters || [];
  let activeFilters = props.activeFilters || {};
  let pagination = props.pagination || { page: 0, pageSize: 0, totalItems: 0 };
  let canSelectAll = props.canSelectAll || false;
  return (
    <React.Fragment>
      <Flex>
        {(filters || onApplyFilter) && (
          <Flex
            spaceItems={{ default: 'spaceItemsXs' }}
            grow={{ default: 'grow' }}
          >
            {filters &&
              filters.map((filter, index) => (
                <FlexItem key={index}>{filter}</FlexItem>
              ))}
            {onApplyFilter && (
              <FlexItem>
                <Button onClick={onApplyFilter}>Apply Filter</Button>
              </FlexItem>
            )}
          </Flex>
        )}
        <Flex
          alignSelf={{ default: 'alignSelfFlexEnd' }}
          direction={{ default: 'column' }}
          align={{ default: 'alignRight' }}
        >
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
      {Object.keys(activeFilters).length > 0 && (
        <Flex style={{ marginTop: '1rem' }}>
          <Flex>
            <FlexItem>Active filters</FlexItem>
          </Flex>
          <Flex grow={{ default: 'grow' }}>
            {Object.keys(activeFilters).map((key) => (
              <FlexItem spacer={{ default: 'spacerXs' }} key={key}>
                {!hideFilters.includes(key) && (
                  <ChipGroup categoryName={key}>
                    <Chip
                      badge={
                        <Badge isRead={true}>{activeFilters[key]['op']}</Badge>
                      }
                      onClick={() => onRemoveFilter(key)}
                    >
                      {typeof activeFilters[key] === 'object' && (
                        <React.Fragment>
                          {activeFilters[key]['val']}
                        </React.Fragment>
                      )}
                      {typeof activeFilters[key] !== 'object' &&
                        activeFilters[key]}
                    </Chip>
                  </ChipGroup>
                )}
              </FlexItem>
            ))}
          </Flex>
          {onApplyReport && (
            <Flex>
              <FlexItem style={{ marginLeft: '0.75em' }}>
                <Button onClick={onApplyReport} variant="secondary">
                  Use Active Filters in Report
                </Button>
              </FlexItem>
            </Flex>
          )}
        </Flex>
      )}
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
        style={{ marginTop: '1rem' }}
      />
    </React.Fragment>
  );
};

FilterTable.propTypes = {
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
  variant: PropTypes.node,
};

export default FilterTable;
