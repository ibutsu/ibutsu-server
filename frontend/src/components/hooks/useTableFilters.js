import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Button,
  MenuToggle,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import {
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  parseFilterValueToSearch,
  parseSearchToFilter,
} from '../../utilities';
import { IbutsuContext } from '../../services/context';
import { TimesIcon } from '@patternfly/react-icons';
import PropTypes from 'prop-types';

const useTableFilters = ({
  fieldOptions = [],
  hideFilters = [], // hides it in the render, not in activeFilters
  blockRemove = [],
  removeCallback = () => {},
}) => {
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Start with search params, ignore pagination
  // set project_id in activeFilters
  const [activeFilters, setActiveFilters] = useState([
    ...Object.entries(Object.fromEntries(searchParams))
      .filter(([k]) => k !== 'page' && k !== 'pageSize')
      .map(([searchKey, searchValue]) => {
        return parseSearchToFilter([searchKey, searchValue]);
      }),
    {
      field: 'project_id',
      operator: 'eq',
      value: primaryObject?.id || params?.project_id,
    },
  ]);

  // Update activeFilters state and search params, handle removal when value is null/empty
  const updateFilters = useCallback(
    ({ field, operator, value, callback = () => {} }) => {
      const newFilters = [...activeFilters];
      const newFilter = { field: field, operator: operator, value: value };
      const newSearchParams = new URLSearchParams(searchParams);

      const existingFilterIndex = newFilters.findIndex(
        (filter) => filter.field === field,
      );
      if (existingFilterIndex > -1) {
        // the field exists in a filter already
        if (value === null || value?.length === 0) {
          // value is empty, splice the filter out
          newFilters.splice(existingFilterIndex, 1);
          newSearchParams.delete(field);
        } else {
          newFilters[existingFilterIndex] = newFilter;

          // Update search params too
          if (!hideFilters.includes(field)) {
            newSearchParams.set(field, parseFilterValueToSearch(newFilter));
          }
        }
      } else {
        // the field doesn't exist yet
        newFilters.push(newFilter);
        newSearchParams.set([field], parseFilterValueToSearch(newFilter));
      }

      // TODO deduplicate newFilters by field
      setActiveFilters(newFilters);
      setSearchParams(newSearchParams.toString());

      callback();
    },
    [activeFilters, hideFilters, searchParams, setSearchParams],
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
      value = inValues?.map((item) => item.trim()).join(';');
    } else if (operationMode === 'bool') {
      value = boolSelection;
    }
    updateFilters({
      field: fieldSelection,
      operator: operationSelection,
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
    setActiveFilters((prevActive) =>
      prevActive.filter((f) => f.field === 'project_id'),
    );
    resetFilters();
    setSearchParams();
  }, [resetFilters, setSearchParams]);

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

  const onOperationSelect = useCallback((_, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
  }, []);

  const onBoolSelect = useCallback((_, selection) => {
    setBoolSelection(selection);
    setIsBoolOpen(false);
  }, []);

  // filter the field options on filter text input
  useEffect(() => {
    let newFieldOptions = [...fieldOptions];
    if (fieldInputValue.length > 0 && isFieldOpen) {
      newFieldOptions = newFieldOptions.filter((menuItem) =>
        menuItem.toLowerCase().includes(fieldFilterValue.toLowerCase()),
      );
      if (
        newFieldOptions.length !== 1 &&
        !newFieldOptions.includes(fieldFilterValue)
      ) {
        newFieldOptions.push(`Create "${fieldFilterValue}"`);
      }
    }
    setFilteredFieldOptions(newFieldOptions);
  }, [fieldFilterValue, fieldInputValue, fieldOptions, isFieldOpen]);

  const filterMode = useMemo(
    () => getFilterMode(fieldSelection),
    [fieldSelection],
  );

  // Get the operation mode (single / multi / bool) for the selected operation
  const operationMode = useMemo(
    () => getOperationMode(operationSelection),
    [operationSelection],
  );

  // Get the operations (string / numeric / array) for the selected field
  const operations = useMemo(
    () => getOperationsFromField(fieldSelection),
    [fieldSelection],
  );

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

  return {
    // States
    activeFilters,
    setActiveFilters,
    boolSelection,
    setBoolSelection,
    fieldSelection,
    setFieldSelection,
    filteredFieldOptions,
    setFilteredFieldOptions,
    inValues,
    setInValues,
    isFieldOpen,
    setIsFieldOpen,
    isOperationOpen,
    setIsOperationOpen,
    operationSelection,
    setOperationSelection,
    textFilter,
    setTextFilter,
    isBoolOpen,
    setIsBoolOpen,
    fieldInputValue,
    setFieldInputValue,
    fieldFilterValue,
    setFieldFilterValue,

    // Functions
    applyFilter,
    clearFilters,
    resetFilters,
    updateFilters,
    onBoolClear,
    onBoolSelect,
    onFieldSelect,
    onOperationSelect,
    onFieldTextInputChange,
    fieldToggle,
    operationToggle,
    boolToggle,
    onRemoveFilter,

    // Memos
    filterMode,
    operationMode,
    operations,
  };
};

useTableFilters.propTypes = {
  fieldOptions: PropTypes.arrayOf(PropTypes.string),
  hideFilters: PropTypes.arrayOf(PropTypes.string),
  blockRemove: PropTypes.arrayOf(PropTypes.string),
  removeCallback: PropTypes.func,
};

export default useTableFilters;
