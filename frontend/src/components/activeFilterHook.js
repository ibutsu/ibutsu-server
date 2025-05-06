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

  useEffect(() => {
    if (primaryObject?.id || params?.project_id) {
      console.log('project effect: primaryObject: ', [
        primaryObject.id,
        activeFilters,
      ]);
      setActiveFilters((prevActive) => {
        return prevActive?.length
          ? prevActive.map((filter) => {
              if (
                filter?.field === 'project_id' &&
                filter?.value !== primaryObject.id
              ) {
                console.log('setting project id in filter');
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryObject, params.project_id]);

  const filterToSearchParam = (filter) => {
    return `[${filter.op}]${filter.value}`;
  };

  // couple active filters to search params
  useEffect(() => {
    activeFilters?.map((filter) => {
      console.log('search param effect: ', filter);
      if (
        !hideFilters.includes(filter?.field) &&
        searchParams.get(filter?.field) !== `[${filter.op}]${filter.value}`
      ) {
        setSearchParams({
          ...searchParams,
          [filter.field]: filterToSearchParam(filter),
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const updateFilters = useCallback(
    (field, operator, value, callback) => {
      console.log('updateFilters', [field, operator, value, activeFilters]);
      let newFilters = [...activeFilters];
      const existingFilterIndex = newFilters.findIndex(
        (filter) => filter.field === field,
      );
      if (existingFilterIndex > -1) {
        // the field exists in a filter already
        if (value === null || value?.length === 0) {
          // value is empty, splice the filter out
          console.log('updateFilters removing: ', field);
          newFilters.splice(existingFilterIndex, 1);
        } else {
          console.log('updateFilters updating: ', field);
          newFilters[existingFilterIndex] = {
            field: field,
            op: operator,
            value: value,
          };
        }
      } else {
        // the field doesn't exist yet
        console.log('updateFilters adding: ', field);
        newFilters.push({ field: field, op: operator, value: value });
      }

      console.log('new filters: ', newFilters);
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
    console.log('activeFiltersToObject', activeFilters);
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

  const activeFilterComponents = useMemo(() => {
    console.log('active filter components: ', activeFilters);
    if (
      activeFilters?.length &&
      activeFilters.filter((filter) => !hideFilters.includes(filter.field))
        .length
    ) {
      return (
        <Flex style={{ marginTop: '1rem' }}>
          <Flex grow={{ default: 'grow' }}>
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
