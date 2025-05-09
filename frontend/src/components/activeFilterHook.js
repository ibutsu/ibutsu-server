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
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import {
  buildApiParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
} from '../utilities';
import { IbutsuContext } from '../services/context';
import { TimesIcon } from '@patternfly/react-icons';
import MultiValueInput from './multivalueinput';

export const useTableFilters = ({
  fieldOptions = [],
  hideFilters = [], // hides it in the render, not in activeFilters
  applyReport = true,
  blockRemove = [],
  removeCallback = () => {},
}) => {
  // caller must implement an applyFilter function to use updateFilters wiith it's state data

  const navigate = useNavigate();
  const params = useParams();
  const { primaryObject } = useContext(IbutsuContext);

  // Filter states: field
  const [filteredFieldOptions, setFilteredFieldOptions] =
    useState(fieldOptions);
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState('');
  const [fieldSelection, setFieldSelection] = useState(null);

  // Filter states: operation
  const [isOperationOpen, setIsOperationOpen] = useState(false);
  const [operationSelection, setOperationSelection] = useState('eq');

  // Filter states: value
  const [textFilter, setTextFilter] = useState('');
  const [isBoolOpen, setIsBoolOpen] = useState(false);
  const [inValues, setInValues] = useState([]);
  const [boolSelection, setBoolSelection] = useState(null);

  // Active Filter States
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

  // Compose the '[op]value' for search params
  const filterToSearchParam = (filter) => {
    return `[${filter.op}]${filter.value}`;
  };

  // filter out the pagination from search params
  const filterParams = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(Object.fromEntries(searchParams)).filter(
          ([k]) => k !== 'page' && k !== 'pageSize',
        ),
      ),
    [searchParams],
  );

  // couple active filters to search params
  useEffect(() => {
    // TODO this is overwriting all search params instead of adding to it when new filters are added
    if (filterParams.length) {
      console.log('filterParams: ', filterParams);
      const newSearchParams = new URLSearchParams(params);
      activeFilters?.map((filter) => {
        if (
          !hideFilters.includes(filter?.field) &&
          searchParams.get(filter?.field) !== filterToSearchParam(filter)
        ) {
          console.log('param effect, activefilter updating: ', filter);
          newSearchParams.set([filter.field], filterToSearchParam(filter));
        }
      });
      setSearchParams(newSearchParams);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams]);

  const updateFilters = useCallback(
    ({ field, operator, value, callback = () => {} }) => {
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

  const resetFilters = useCallback(() => {
    setFieldFilterValue('');
    setFieldInputValue('');
    setFieldSelection();
    setBoolSelection();
    setIsBoolOpen(false);
    setOperationSelection('eq');
    setInValues([]);
    setTextFilter('');
  }, []);

  // Apply the given filter
  const applyFilter = useCallback(() => {
    const operationMode = getOperationMode(operationSelection);
    let value = textFilter.trim();
    if (operationMode === 'multi') {
      value = inValues.map((item) => item.trim()).join(';');
    } else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters({
      field: fieldSelection,
      opeator: operationSelection,
      value: value,
      callback: resetFilters,
    });
  }, [
    operationSelection,
    textFilter,
    updateFilters,
    fieldSelection,
    resetFilters,
    inValues,
    boolSelection,
  ]);

  const onRemoveFilter = useCallback(
    (id) => {
      if (blockRemove?.length && blockRemove.includes(id)) {
        return;
      }

      updateFilters({
        field: id,
        operator: null,
        value: null,
        callback: removeCallback,
      });
    },
    [blockRemove, removeCallback, updateFilters],
  );

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
    resetFilters();
  }, []);

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

  const onFieldSelect = useCallback(
    (_, selection) => {
      if (selection === `Create "${fieldFilterValue}"`) {
        setFilteredFieldOptions((prev) => [...prev, fieldFilterValue]);
        setFieldSelection(fieldFilterValue);
        setFieldInputValue(fieldFilterValue);
        setOperationSelection('eq');
      } else {
        setFieldSelection(selection);
        setFieldInputValue(selection);
      }

      setIsFieldOpen(false);
      setOperationSelection('eq');
    },
    [fieldFilterValue],
  );

  const onOperationSelect = useCallback((event, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
  }, []);

  const onBoolSelect = useCallback((event, selection) => {
    setBoolSelection(selection);
    setIsBoolOpen(false);
  }, []);

  // filter the field options on filter text input
  useEffect(() => {
    let newSelectOptionsField = [...fieldOptions];
    if (fieldInputValue) {
      newSelectOptionsField = fieldOptions.filter((menuItem) =>
        menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase()),
      );
      if (
        newSelectOptionsField.length !== 1 &&
        !newSelectOptionsField.includes(fieldFilterValue)
      ) {
        newSelectOptionsField.push(`Create "${fieldFilterValue}"`);
      }
    }
    setFilteredFieldOptions(newSelectOptionsField);
  }, [fieldFilterValue, fieldInputValue, fieldOptions, isFieldOpen]);

  const filterMode = getFilterMode(fieldSelection);
  const operationMode = getOperationMode(operationSelection);
  const operations = getOperationsFromField(fieldSelection);
  const onFieldTextInputChange = useCallback((_, value) => {
    setFieldInputValue(value);
    setFieldFilterValue(value);
  }, []);

  const onFieldClear = useCallback(() => {
    setFieldSelection(null);
    setFieldFilterValue('');
    setFieldInputValue('');
  }, []);

  const onBoolClear = useCallback(() => {
    setBoolSelection(null);
    setIsBoolOpen(false);
  }, []);
  const fieldToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        variant="typeahead"
        aria-label="Typeahead creatable menu toggle"
        onClick={() => setIsFieldOpen(!isFieldOpen)}
        isExpanded={isFieldOpen}
        isFullWidth
        innerRef={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={fieldInputValue}
            onClick={() => setIsFieldOpen(!isFieldOpen)}
            onChange={onFieldTextInputChange}
            id="create-typeahead-select-input"
            autoComplete="off"
            placeholder="Select a field"
            role="combobox"
            isExpanded={isFieldOpen}
            aria-controls="select-create-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {!!fieldInputValue && (
              <Button
                variant="plain"
                onClick={onFieldClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [fieldInputValue, isFieldOpen, onFieldClear, onFieldTextInputChange],
  );

  const operationToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsOperationOpen(!isOperationOpen)}
        isExpanded={isOperationOpen}
        isFullWidth
        ref={toggleRef}
      >
        {operationSelection}
      </MenuToggle>
    ),
    [isOperationOpen, operationSelection],
  );

  const boolToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsBoolOpen(!isBoolOpen)}
        isExpanded={isBoolOpen}
        isFullWidth
        ref={toggleRef}
        style={{ maxHeight: '36px' }}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={boolSelection}
            onClick={() => setIsBoolOpen(!isBoolOpen)}
            autoComplete="off"
            placeholder="Select True/False"
            role="combobox"
            isExpanded={isBoolOpen}
          />
          <TextInputGroupUtilities>
            {!!boolSelection && (
              <Button
                variant="plain"
                onClick={onBoolClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [boolSelection, isBoolOpen, onBoolClear],
  );
  const filterComponents = useMemo(
    () => [
      <Select
        id="typeahead-select"
        selected={fieldSelection}
        isOpen={isFieldOpen}
        onSelect={onFieldSelect}
        key="field"
        onOpenChange={() => setIsFieldOpen(false)}
        toggle={fieldToggle}
      >
        <SelectList id="select-typeahead-listbox">
          {filteredFieldOptions.map((option, index) => (
            <SelectOption key={index} value={option}>
              {option}
            </SelectOption>
          ))}
        </SelectList>
      </Select>,
      <Select
        id="single-select"
        isOpen={isOperationOpen}
        selected={operationSelection}
        onSelect={onOperationSelect}
        onOpenChange={() => setIsOperationOpen(false)}
        key="operation"
        toggle={operationToggle}
      >
        <SelectList>
          {Object.keys(operations).map((option, index) => (
            <SelectOption key={index} value={option}>
              {option}
            </SelectOption>
          ))}
        </SelectList>
      </Select>,
      <React.Fragment key="value">
        {operationMode === 'bool' && (
          <Select
            id="single-select"
            isOpen={isBoolOpen}
            selected={boolSelection}
            onSelect={onBoolSelect}
            onOpenChange={() => setIsBoolOpen(false)}
            toggle={boolToggle}
          >
            <SelectList>
              {['True', 'False'].map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        )}
        {filterMode === 'text' && operationMode === 'single' && (
          <TextInput
            type="text"
            id="textSelection"
            placeholder="Type in value"
            value={textFilter}
            onChange={(_, newValue) => setTextFilter(newValue)}
            style={{ height: 'inherit' }}
          />
        )}
        {operationMode === 'multi' && (
          <MultiValueInput
            onValuesChange={(values) => setInValues(values)}
            style={{ height: 'inherit' }}
          />
        )}
      </React.Fragment>,
    ],
    [
      fieldSelection,
      isFieldOpen,
      onFieldSelect,
      fieldToggle,
      filteredFieldOptions,
      isOperationOpen,
      operationSelection,
      onOperationSelect,
      operationToggle,
      operations,
      operationMode,
      isBoolOpen,
      boolSelection,
      onBoolSelect,
      boolToggle,
      filterMode,
      textFilter,
      setInValues,
    ],
  );

  return {
    activeFilters,
    activeFilterComponents,
    boolSelection,
    clearFilters,
    fieldSelection,
    filterComponents,
    filterToSearchParam,
    inValues,
    operationSelection,
    setActiveFilters,
    setBoolSelection,
    setFieldSelection,
    setInValues,
    setOperationSelection,
    setTextFilter,
    updateFilters,
    applyFilter,
    activeFiltersToObject,
    activeFiltersToApiParams,
    onApplyReport,
    textFilter,
  };
};
