import PropTypes from 'prop-types';
import React, { useState } from 'react';

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
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  ExpandableRowContent,
  Table,
} from '@patternfly/react-table';

import { TableEmptyState, TableErrorState } from '../tablestates';

const FilterTable = ({
  selectable = false,
  expandable = false,
  isError,
  onCollapse,
  onRowSelectCallback,
  onClearFilters,
  onSetPage,
  onSetPageSize,
  variant,
  columns,
  rows,
  page,
  pageSize,
  totalItems,
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

  const [selectedRows, setSelectedRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);

  // Handle setting a single row as selected/unselected
  const setRowSelected = (row, isSelected = true) => {
    if (isSelected) {
      setSelectedRows((prev) => [...prev, row.id]);
    } else {
      setSelectedRows((prev) => prev.filter((id) => id !== row.id));
    }
  };

  // Handle select/unselect all rows
  const selectAllRows = (event, isSelected) => {
    if (!rows) return;

    if (isSelected) {
      setSelectedRows(rows.map((row) => row.id));
    } else {
      setSelectedRows([]);
    }

    // Callback to parent with all rows selection state
    onRowSelectCallback && onRowSelectCallback(event, isSelected, -1);
  };

  // Compare rows.length to selectedRows.length and check if every row id is included
  const areAllRowsSelected =
    rows?.length > 0 &&
    rows?.length === selectedRows?.length &&
    rows.every((row) => selectedRows.includes(row.id));

  // Handle individual row selection
  const onSelectRow = (event, isSelected, rowIndex) => {
    const row = rows[rowIndex];
    setRowSelected(row, isSelected);
    onRowSelectCallback && onRowSelectCallback(event, isSelected, rowIndex);
  };

  // Check if a row is expanded
  const isRowExpanded = (row) => expandedRows.includes(row.id);

  // Handle row expansion
  const setRowExpanded = (row, isExpanding = true) => {
    setExpandedRows((prevExpanded) => {
      const otherExpandedRows = prevExpanded.filter((id) => id !== row.id);
      return isExpanding ? [...otherExpandedRows, row.id] : otherExpandedRows;
    });
  };

  // Handle expand toggle
  const handleToggle = (event, rowIndex) => {
    const row = rows[rowIndex];
    const isExpanding = !isRowExpanded(row);
    setRowExpanded(row, isExpanding);

    // Call parent callback if provided
    if (onCollapse) {
      onCollapse(event, rowIndex, isExpanding);
    }
  };

  const renderTableRows = () => {
    if (!rows) {
      return null;
    }

    return rows.map((row, rowIndex) => {
      const isExpanded = isRowExpanded(row);
      const isSelected = row.selected || selectedRows.includes(row.id);

      return (
        <Tbody key={row.id} isExpanded={isExpanded}>
          <Tr>
            {selectable && (
              <Td
                select={{
                  onSelect: (e, s) => onSelectRow(e, s, rowIndex),
                  isSelected: isSelected,
                  rowIndex,
                }}
              />
            )}
            {expandable && (
              <Td
                expand={{
                  rowIndex,
                  isExpanded: isExpanded,
                  onToggle: handleToggle,
                  expandId: `expandable-row-${row.id}`,
                }}
              />
            )}

            {row.cells &&
              row.cells.map((cell, cellIndex) => {
                // Handle different cell formats properly
                let cellContent;
                if (cell === null || cell === undefined) {
                  cellContent = null;
                } else if (typeof cell === 'string') {
                  cellContent = cell;
                } else if (typeof cell === 'object') {
                  // React elements can be directly rendered
                  if (React.isValidElement(cell)) {
                    cellContent = cell;
                  }
                  // Objects with title property (PatternFly table cell format)
                  else if ('title' in cell) {
                    cellContent = cell.title;
                  }
                  // Fallback for other object types
                  else {
                    cellContent = cell;
                  }
                } else {
                  cellContent = cell;
                }

                return <Td key={cellIndex}>{cellContent}</Td>;
              })}
          </Tr>
          {expandable && row.expandedContent && isExpanded && (
            <Tr isExpanded={isExpanded}>
              {selectable && <Td />}
              <Td colSpan={columns.length + (expandable ? 1 : 0)} noPadding>
                <ExpandableRowContent>
                  {row.expandedContent}
                </ExpandableRowContent>
              </Td>
            </Tr>
          )}
        </Tbody>
      );
    });
  };

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
            aria-label="List"
            variant={variant}
          >
            <Thead>
              <Tr>
                {selectable && (
                  <Th
                    select={{
                      onSelect: selectAllRows,
                      isSelected: areAllRowsSelected,
                      isDisabled: !rows || rows.length === 0,
                    }}
                  />
                )}
                {expandable && <Th screenReaderText="Row expansion" />}
                {columns.map((column, columnIndex) => (
                  <Th key={columnIndex}>
                    {typeof column === 'string' ? column : column?.title}
                  </Th>
                ))}
              </Tr>
            </Thead>
            {!rows && (
              <Tbody>
                <Tr>
                  <Td
                    colSpan={
                      columns.length +
                      (selectable ? 1 : 0) +
                      (expandable ? 1 : 0)
                    }
                  >
                    No rows data
                  </Td>
                </Tr>
              </Tbody>
            )}
            {rows && rows.length === 0 && (
              <Tbody>
                <Tr>
                  <Td
                    colSpan={
                      columns.length +
                      (selectable ? 1 : 0) +
                      (expandable ? 1 : 0)
                    }
                  >
                    Empty rows array
                  </Td>
                </Tr>
              </Tbody>
            )}
            {rows && rows.length > 0 && renderTableRows()}
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
  filters: PropTypes.node,
  isError: PropTypes.bool,
  onCollapse: PropTypes.func,
  onClearFilters: PropTypes.func,
  onSetPage: PropTypes.func,
  onSetPageSize: PropTypes.func,
  onRowSelectCallback: PropTypes.func,
  variant: PropTypes.node,
  footerChildren: PropTypes.node,
  headerChildren: PropTypes.node,
  cardClass: PropTypes.string,
  fetching: PropTypes.bool,
  page: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  pageSize: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totalItems: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  selectable: PropTypes.bool,
  expandable: PropTypes.bool,
};

export default FilterTable;
