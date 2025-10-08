import PropTypes from 'prop-types';
import React, { isValidElement, useState } from 'react';

import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Flex,
  FlexItem,
  Pagination,
  PaginationVariant,
} from '@patternfly/react-core';
import SkeletonTable from '@patternfly/react-component-groups/dist/dynamic/SkeletonTable';

import {
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  ExpandableRowContent,
  Table,
} from '@patternfly/react-table';

import { TableEmptyState, TableErrorState } from '../table-states';

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
  cardClass = 'pf-v6-u-p-0',
  fetching = false,
  filters,
  sortBy = null,
  onSort = null,
  sortFunctions = {},
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

  // Handle column sorting
  const getSortParams = (columnIndex) => {
    if (!onSort || !sortFunctions || Object.keys(sortFunctions).length === 0) {
      return {};
    }

    const columnName =
      typeof columns[columnIndex] === 'string'
        ? columns[columnIndex].toLowerCase()
        : columns[columnIndex]?.title?.toLowerCase() || '';

    if (!sortFunctions[columnName]) {
      return {};
    }

    return {
      sort: {
        sortBy: sortBy,
        onSort: (event, index, direction) =>
          onSort(event, index, direction, columnName),
        columnIndex: columnIndex,
      },
    };
  };

  const renderTableRows = () => {
    if (!rows) {
      return null;
    }

    return (
      <Tbody>
        {rows.map((row, rowIndex) => {
          const isExpanded = isRowExpanded(row);
          const isSelected = row.selected || selectedRows.includes(row.id);

          return (
            <React.Fragment key={row.id}>
              <Tr key={`${row.id}-tr`}>
                {selectable && (
                  <Td
                    key={`${row.id}-select`}
                    select={{
                      onSelect: (e, s) => onSelectRow(e, s, rowIndex),
                      isSelected: isSelected,
                      rowIndex,
                    }}
                  />
                )}
                {expandable && (
                  <Td
                    key={`${row.id}-expand`}
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
                    // Sanitize cell content to prevent filter objects from being rendered
                    const sanitizedCell = cell;

                    // Handle different cell formats properly
                    let cellContent;
                    if (sanitizedCell === null || sanitizedCell === undefined) {
                      cellContent = null;
                    } else if (
                      // Strings, numbers, and arrays can be rendered directly
                      typeof sanitizedCell === 'string' ||
                      typeof sanitizedCell === 'number' ||
                      Array.isArray(sanitizedCell) ||
                      (typeof sanitizedCell === 'object' &&
                        isValidElement(sanitizedCell))
                    ) {
                      cellContent = sanitizedCell;
                    } else if (
                      typeof sanitizedCell === 'object' &&
                      'title' in sanitizedCell
                    ) {
                      // Objects with title property (PatternFly table cell format)
                      cellContent = sanitizedCell.title;
                    }
                    // Fallback for other object types - convert to string to avoid React error
                    else {
                      console.warn(
                        'FilterTable: Non-renderable object in cell content:',
                        sanitizedCell,
                      );
                      cellContent = JSON.stringify(sanitizedCell);
                    }

                    return <Td key={`${row.id}${cellIndex}`}>{cellContent}</Td>;
                  })}
              </Tr>
              {expandable && row.expandedContent && isExpanded && (
                <Tr key={`${row.id}-tr-expanded`} isExpanded={isExpanded}>
                  {selectable && <Td key={`${row.id}-td-select-expanded`} />}
                  <Td
                    colSpan={columns.length + (expandable ? 1 : 0)}
                    noPadding
                    key={`${row.id}-td-expanded`}
                  >
                    <ExpandableRowContent>
                      {row.expandedContent}
                    </ExpandableRowContent>
                  </Td>
                </Tr>
              )}
            </React.Fragment>
          );
        })}
      </Tbody>
    );
  };

  return (
    <Card ouiaId="filter-table-card" className={cardClass}>
      {headerChildren ? (
        <>
          <CardHeader>{headerChildren}</CardHeader>
          <Divider />
        </>
      ) : null}
      {filters || null}
      {fetching && (
        <CardBody key="loading-table">
          <SkeletonTable rowsCount={10} columns={columns} variant={variant} />
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
                  <Th key={columnIndex} {...getSortParams(columnIndex)}>
                    {typeof column === 'string' ? column : column?.title}
                  </Th>
                ))}
              </Tr>
            </Thead>
            {!rows && (
              <Tbody>
                <Tr key="no-rows">
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
                <Tr key="empty-rows">
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
  sortBy: PropTypes.object,
  onSort: PropTypes.func,
  sortFunctions: PropTypes.object,
};

export default FilterTable;
