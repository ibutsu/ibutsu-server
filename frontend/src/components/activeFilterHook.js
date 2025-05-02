import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OPERATIONS } from '../constants';
import {
  Badge,
  Button,
  Chip,
  ChipGroup,
  Flex,
  FlexItem,
} from '@patternfly/react-core';

export const useActiveFilters = ({
  initFilters = [],
  hideFilters = [],
  onRemoveFilter = () => undefined,
  onApplyReport = () => undefined,
}) => {
  // caller must implement an applyFilter function to use updateFilters wiith it's state data

  const [activeFilters, setActiveFilters] = useState(initFilters || []); // [{field, op, val}]
  const [searchParams, setSearchParams] = useSearchParams();

  const updateFilters = useCallback(
    (field, operator, value, callback) => {
      let newFilters = activeFilters.map((activeFilter) => {
        if (
          // if the value is null or empty, remove the filter with the matching field
          (value === null || value.length === 0) &&
          activeFilter.field === field
        ) {
          return;
        } else if (activeFilter.field === field) {
          return { field: field, op: operator, val: value };
        }
      });
      setActiveFilters(newFilters);
      callback();
    },
    [activeFilters],
  );

  const buildFilterSearchParam = (filter) => {
    return `[${filter.op}]${filter.value}`;
  };

  const activeFiltersToObject = () => {
    return activeFilters.reduce(
      (acc, filter) => (acc[filter.field] = { op: filter.op, val: filter.val }),
      {},
    );
  };

  const activeFiltersToApiParams = (filters) => {
    const apiParamArray = [];
    for (let key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        !!filters[key]
      ) {
        const val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        apiParamArray.push(key + op + val);
      }
    }
  };

  const filterParams = Object.fromEntries(
    Object.entries(Object.fromEntries(searchParams)).filter(
      ([k]) => k !== 'page' && k !== 'pageSize',
    ),
  );
  console.log('filterParams', filterParams);

  // couple active filters to search params
  useEffect(() => {
    activeFilters.map((filter) => {
      console.log('active filter update: ', filter);
      if (searchParams.get(filter.field) !== `[${filter.op}]${filter.value}`) {
        setSearchParams({
          ...searchParams,
          [filter.field]: buildFilterSearchParam(filter),
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const activeFilterComponents = useMemo(() => {
    if (activeFilters.length === 0) {
      return (
        <Flex style={{ marginTop: '1rem' }}>
          <Flex>
            <FlexItem>Active filters</FlexItem>
          </Flex>
          <Flex grow={{ default: 'grow' }}>
            {activeFilters.map((activeFilter) => (
              <FlexItem
                spacer={{ default: 'spacerXs' }}
                key={activeFilter?.field}
              >
                {!hideFilters.includes(activeFilter?.field) && (
                  <ChipGroup categoryName={activeFilter?.field}>
                    <Chip
                      badge={<Badge isRead={true}>{activeFilter.op}</Badge>}
                      onClick={() => onRemoveFilter(activeFilter.field)}
                    >
                      {typeof activeFilter === 'object' && (
                        <React.Fragment>{activeFilters?.val}</React.Fragment>
                      )}
                      {typeof activeFilter !== 'object' && activeFilter}
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
      );
    }
  }, [activeFilters, onApplyReport, hideFilters, onRemoveFilter]);

  return {
    activeFilters,
    setActiveFilters,
    updateFilters,
    buildFilterSearchParam,
    activeFiltersToObject,
    activeFiltersToApiParams,
    activeFilterComponents,
  };
};
