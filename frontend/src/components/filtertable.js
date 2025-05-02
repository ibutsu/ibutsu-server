import React, { act } from 'react';
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
import { useActiveFilters } from './activeFilterHook';

const FilterTable = ({
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
  columns = [],
  rows = [],
  actions = [],
  filters = [],
  hideFilters = [],
  activeFilters = [],
  pagination = { page: 0, pageSize: 0, totalItems: 0 },
  canSelectAll = false,
}) => {
  const { activeFilterComponents } = useActiveFilters({
    initFilters: activeFilters,
    hideFilters: hideFilters,
    onApplyFilter: onApplyFilter,
    onRemoveFilter: onRemoveFilter,
    onApplyReport: onApplyReport,
  });
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
      {activeFilterComponents}
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
  activeFilters: PropTypes.arrayOf(PropTypes.object),
  hideFilters: PropTypes.arrayOf(PropTypes.string),
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
