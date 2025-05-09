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
  HelperText,
  HelperTextItem,
  Text,
} from '@patternfly/react-core';
import { buildApiParams } from '../utilities';
import { IbutsuContext } from '../services/context';

export const useActiveFilters = ({
  hideFilters = [], // hides it in the render, not in activeFilters
  applyReport = true,
  blockRemove = [],
  removeCallback = () => {},
}) => {
  // caller must implement an applyFilter function to use updateFilters wiith it's state data

  const navigate = useNavigate();
  const params = useParams();
  const { primaryObject } = useContext(IbutsuContext);

  // default the project_id if primaryObject is set in context
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Apply the project_id filter to activeFilters automatically
  useEffect(() => {
    if (primaryObject?.id || params?.project_id) {
      setActiveFilters((prevActive) => {
        return prevActive?.length
          ? prevActive.map((filter) => {
              if (
                filter?.field === 'project_id' &&
                filter?.value !== primaryObject.id
              ) {
                return { ...filter, value: primaryObject.id };
              } else {
                return filter;
              }
            })
          : [
              {
                field: 'project_id',
                op: 'eq',
                value: primaryObject?.id || params?.project_id,
              },
            ];
      });
    }
  }, [primaryObject, params.project_id]);

  const filterToSearchParam = (filter) => {
    return `[${filter.op}]${filter.value}`;
  };

  // couple active filters to search params
  useEffect(() => {
    // TODO this is overwriting all search params instead of adding to it when new filters are added
    if (activeFilters.length || searchParams.length) {
      activeFilters?.map((filter) => {
        console.log('param effect, activeFilter: ', filter);
        if (
          !hideFilters.includes(filter?.field) &&
          searchParams.get(filter?.field) !== filterToSearchParam(filter)
        ) {
          console.log('param effect, setting search params: ', ...searchParams);
          setSearchParams((prevParams) => {
            prevParams.set([filter.field], filterToSearchParam(filter));
            return prevParams;
          });
        }
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const updateFilters = useCallback(
    (field, operator, value, callback) => {
      let newFilters = [...activeFilters];
      const existingFilterIndex = newFilters.findIndex(
        (filter) => filter.field === field,
      );
      if (existingFilterIndex > -1) {
        // the field exists in a filter already
        if (value === null || value?.length === 0) {
          // value is empty, splice the filter out
          newFilters.splice(existingFilterIndex, 1);
        } else {
          newFilters[existingFilterIndex] = {
            field: field,
            op: operator,
            value: value,
          };
        }
      } else {
        // the field doesn't exist yet
        newFilters.push({ field: field, op: operator, value: value });
      }

      setActiveFilters(newFilters);
      callback();
    },
    [activeFilters],
  );

  const onRemoveFilter = useCallback(
    (id) => {
      if (blockRemove?.length && blockRemove.includes(id)) {
        return;
      }

      updateFilters(id, null, null, removeCallback);
    },
    [blockRemove, removeCallback, updateFilters],
  );

  // TODO remove, convert everything to use the list
  const activeFiltersToObject = useCallback(() => {
    return activeFilters?.reduce(
      (acc, filter) =>
        (acc[filter.field] = { op: filter.op, value: filter.value }),
      {},
    );
  }, [activeFilters]);

  // array of API formatted filter strings
  const activeFiltersToApiParams = useCallback(() => {
    if (activeFilters?.length) {
      const apiFilters = [...activeFilters];
      const apiParamArray = [];
      for (let { key, op, value } in apiFilters) {
        const apiOperation = OPERATIONS[op];
        apiParamArray.push(key + apiOperation + value);
      }
      return apiParamArray;
    } else {
      return [];
    }
  }, [activeFilters]);

  // const filterParams = Object.fromEntries(
  //   Object.entries(Object.fromEntries(searchParams)).filter(
  //     ([k]) => k !== 'page' && k !== 'pageSize',
  //   ),
  // );
  // console.log('filterParams', filterParams);

  const onApplyReport = useCallback(
    () =>
      navigate(
        `/project/${params?.project_id || primaryObject.id}/reports?${buildApiParams(activeFilters).join('&')}`,
      ),
    [activeFilters, navigate, params?.project_id, primaryObject.id],
  );

  const activeFilterComponents = useMemo(() => {
    if (
      activeFilters?.length &&
      activeFilters.filter((filter) => !hideFilters.includes(filter.field))
        .length
    ) {
      return (
        <Flex style={{ marginTop: '.75rem' }} direction={{ default: 'column' }}>
          {applyReport && (
            <Flex>
              <FlexItem>
                <Button
                  onClick={onApplyReport}
                  variant="link"
                  size="sm"
                  type="button"
                >
                  Transfer active filters to Report Builder
                </Button>
              </FlexItem>
            </Flex>
          )}

          <Flex direction={{ default: 'row' }}>
            {activeFilters?.map((activeFilter) => (
              <FlexItem
                spacer={{ default: 'spacerXs' }}
                key={activeFilter?.field}
              >
                {!hideFilters?.includes(activeFilter?.field) && (
                  <ChipGroup categoryName={activeFilter?.field}>
                    <Chip
                      badge={<Badge isRead={true}>{activeFilter?.op}</Badge>}
                      onClick={() => onRemoveFilter(activeFilter?.field)}
                    >
                      {typeof activeFilter === 'object' && (
                        <React.Fragment>{activeFilter?.value}</React.Fragment>
                      )}
                      {typeof activeFilter !== 'object' && activeFilter}
                    </Chip>
                  </ChipGroup>
                )}
              </FlexItem>
            ))}
          </Flex>
        </Flex>
      );
    } else {
      return (
        <Flex>
          <FlexItem>
            <HelperText>
              <HelperTextItem>
                Add filters to limit the table scope
              </HelperTextItem>
            </HelperText>
          </FlexItem>
        </Flex>
      );
    }
  }, [activeFilters, applyReport, hideFilters, onApplyReport, onRemoveFilter]);

  return {
    activeFilters,
    setActiveFilters,
    updateFilters,
    filterToSearchParam,
    activeFiltersToObject,
    activeFiltersToApiParams,
    activeFilterComponents,
    onApplyReport,
  };
};
