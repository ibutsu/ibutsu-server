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
  Skeleton,
} from '@patternfly/react-core';

import {
  Table,
  TableBody,
  TableHeader,
} from '@patternfly/react-table/deprecated';

import { TableEmptyState, TableErrorState } from '../tablestates';

const FilterTable = ({
  isError,
  onCollapse,
  onRowSelect,
  onClearFilters,
  onSetPage,
  onSetPageSize,
  variant,
  columns,
  rows,
  actions,
  page,
  pageSize,
  totalItems,
  canSelectAll = false,
  footerChildren = null,
  headerChildren = null,
  cardClass = 'pf-v5-u-p-0',
  fetching = false,
  filters,
}) => {
  // boolean for JSX control, if done fetching check the array length
  const populatedRows = fetching
    ? false // still fetching
    : rows
      ? rows.length !== 0
      : false;

  return (
    <Card ouiaId="filter-table-card" className={cardClass}>
      {headerChildren ? <CardHeader>{headerChildren}</CardHeader> : null}
      {filters || null}
      {fetching && (
        <CardBody key="loading-table">
          <Skeleton />
        </CardBody>
      )}
      {!fetching && !isError && populatedRows && (
        <CardBody key="table">
          <Flex
            alignSelf={{ default: 'alignSelfFlexEnd' }}
            direction={{ default: 'column' }}
            align={{ default: 'alignRight' }}
          >
            <FlexItem>
              <Pagination
                ouiaId="filter-table-pagination"
                perPage={pageSize}
                page={page}
                variant={PaginationVariant.top}
                itemCount={totalItems}
                onSetPage={onSetPage}
                onPerPageSelect={onSetPageSize}
                isCompact
              />
            </FlexItem>
          </Flex>
          <Table
            ouiaId="filter-table-table"
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
          <Pagination
            widgetId="pagination-options-menu-bottom"
            perPage={pageSize}
            page={page}
            variant={PaginationVariant.bottom}
            itemCount={totalItems}
            dropDirection="up"
            onSetPage={onSetPage}
            onPerPageSelect={onSetPageSize}
            style={{ marginTop: '1rem' }}
          />
        </CardBody>
      )}
      {!fetching && !isError && !populatedRows && (
        <CardBody key="empty-table">
          <TableEmptyState onClearFilters={onClearFilters} />
        </CardBody>
      )}
      {!fetching && isError && (
        <CardBody key="error-table">
          <TableErrorState onClearFilters={onClearFilters} />
        </CardBody>
      )}
      {!fetching && footerChildren ? (
        <CardFooter key="footer">{footerChildren}</CardFooter>
      ) : null}
    </Card>
  );
};

FilterTable.propTypes = {
  columns: PropTypes.array,
  rows: PropTypes.array,
  actions: PropTypes.array,
  filters: PropTypes.node,
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
  page: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  pageSize: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totalItems: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default FilterTable;
