import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useContext,
} from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { OPERATIONS } from '../constants';
import {
  Badge,
  Button,
  Chip,
  ChipGroup,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { buildApiParams } from '../utilities';
import { IbutsuContext } from '../services/context';

export const useActiveFilters = ({
  hideFilters = [],
  applyReport = true,
  blockRemove = [],
  removeCallback = () => {},
}) => {
  // caller must implement an applyFilter function to use updateFilters wiith it's state data

  const navigate = useNavigate();
  const params = useParams();
  const { primaryObject } = useContext(IbutsuContext);
  const [activeFilters, setActiveFilters] = useState([]); // [{field, op, val}]
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

  const onRemoveFilter = useCallback(
    (id) => {
      if (blockRemove.length && blockRemove.includes(id)) {
        return;
      }

      updateFilters(id, null, null, removeCallback);
    },
    [blockRemove, removeCallback, updateFilters],
  );

  const buildFilterSearchParam = (filter) => {
    return `[${filter.op}]${filter.value}`;
  };

  const activeFiltersToObject = useCallback(() => {
    return activeFilters.reduce(
      (acc, filter) => (acc[filter.field] = { op: filter.op, val: filter.val }),
      {},
    );
  }, [activeFilters]);

  const activeFiltersToApiParams = useCallback((filters) => {
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
  }, []);

  const filterParams = Object.fromEntries(
    Object.entries(Object.fromEntries(searchParams)).filter(
      ([k]) => k !== 'page' && k !== 'pageSize',
    ),
  );
  console.log('filterParams', filterParams);

  const onApplyReport = useCallback(
    () =>
      navigate(
        `/project/${params?.project_id || primaryObject.id}/reports?${buildApiParams(activeFilters).join('&')}`,
      ),
    [activeFilters, navigate, params?.project_id, primaryObject.id],
  );

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
                {!hideFilters?.includes(activeFilter?.field) && (
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
          {applyReport && (
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
  }, [activeFilters, applyReport, hideFilters]);

  return {
    activeFilters,
    setActiveFilters,
    updateFilters,
    buildFilterSearchParam,
    activeFiltersToObject,
    activeFiltersToApiParams,
    activeFilterComponents,
    onApplyReport,
  };
};
