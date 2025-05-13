import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
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
import { getSpinnerRow } from '../utilities';
import React from 'react';

const FilterTable = ({
  isError,
  onCollapse,
  onRowSelect,
  onClearFilters,
  onSetPage,
  onSetPageSize,
  variant,
  columns = [],
  rows = [],
  actions = [],
  filters = <React.Fragment />,
  pagination = { page: 0, pageSize: 0, totalItems: 0 },
  canSelectAll = false,
  footerChildren = null,
  headerChildren = null,
  cardClass = 'pf-u-p-0',
  fetching = false,
}) => {
  return (
    <Card ouiaId="filter-table-card" className={cardClass}>
      {headerChildren && <CardHeader>{headerChildren}</CardHeader>}
      {filters}
      {(rows?.length || fetching) && (
        <CardBody key="table">
          <Flex
            alignSelf={{ default: 'alignSelfFlexEnd' }}
            direction={{ default: 'column' }}
            align={{ default: 'alignRight' }}
          >
            <FlexItem>
              <Pagination
                ouiaId="filter-table-pagination"
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
          <Table
            ouiaId="filter-table-table"
            cells={columns}
            rows={fetching ? [getSpinnerRow(columns.length || 1)] : rows}
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
        </CardBody>
      )}
      {!rows.length && !isError && !fetching && (
        <CardBody key="empty-table">
          <TableEmptyState onClearFilters={onClearFilters} />
        </CardBody>
      )}
      {isError && (
        <CardBody key="error-table">
          <TableErrorState onClearFilters={onClearFilters} />
        </CardBody>
      )}
      {footerChildren && <CardFooter key="footer">{footerChildren}</CardFooter>}
    </Card>
  );
};

FilterTable.propTypes = {
  columns: PropTypes.array,
  rows: PropTypes.array,
  actions: PropTypes.array,
  filters: PropTypes.node,
  pagination: PropTypes.object,
  isError: PropTypes.bool,
  canSelectAll: PropTypes.bool,
  onCollapse: PropTypes.func,
  onClearFilters: PropTypes.func,
  onSetPage: PropTypes.func,
  onSetPageSize: PropTypes.func,
  onRowSelect: PropTypes.func,
  variant: PropTypes.node,
  footerChildren: PropTypes.node,
  headerChildren: PropTypes.node,
  cardClass: PropTypes.string,
  fetching: PropTypes.bool,
};

export default FilterTable;
