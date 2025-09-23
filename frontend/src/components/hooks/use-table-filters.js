import { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import {
  useSearchParams,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  Button,
  MenuToggle,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import {
  getOperationsFromField,
  parseFilterValueToSearch,
  parseSearchToFilter,
} from '../../utilities';
import { IbutsuContext } from '../contexts/ibutsu-context';
import { TimesIcon } from '@patternfly/react-icons';
import PropTypes from 'prop-types';
import { OPERATION_MODE_MAP, FILTER_MODE_MAP } from '../../constants';

const useTableFilters = ({
  fieldOptions,
  hideFilters, // hides it in the render, not in activeFilters
  blockRemove,
  removeCallback = () => {},
  initialFilters = [], // Initial filters for widget editing
}) => {
  const { project_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryObject } = useContext(IbutsuContext);

  // set initial fieldOptions, but we don't try to keep it in sync with the prop
  const [fieldOptionsState, setFieldOptionsState] = useState([
    ...(fieldOptions || []),
  ]);

  // Filter states: field
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
  const [searchParams] = useSearchParams();

  // Start with search params or initialFilters, ignore pagination
  // set project_id in activeFilters
  const [activeFilters, setActiveFilters] = useState(() => {
    if (initialFilters.length > 0) {
      // Use initialFilters for widget editing (don't use URL params)
      return [...initialFilters];
    }
    // Use search params for normal table filtering
    return [
      ...Object.entries(Object.fromEntries(searchParams))
        .filter(([k]) => k !== 'page' && k !== 'pageSize')
        .map(([searchKey, searchValue]) => {
          return parseSearchToFilter([searchKey, searchValue]);
        }),
    ];
  });

  useEffect(() => {
    if (project_id) {
      setActiveFilters((prevActive) =>
        prevActive
          .filter((f) => f.field !== 'project_id')
          .concat({
            field: 'project_id',
            operator: 'eq',
            value: primaryObject?.id || project_id,
          }),
      );
    }
  }, [project_id, primaryObject?.id]);

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
          if (hideFilters && !hideFilters.includes(field)) {
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

      // Only navigate if not in widget editing mode (initialFilters provided)
      if (initialFilters.length === 0) {
        navigate({
          pathname: location.pathname,
          search: newSearchParams.toString(),
          hash: location.hash,
        });
      }

      callback();
    },
    [
      activeFilters,
      hideFilters,
      location.hash,
      location.pathname,
      navigate,
      searchParams,
      initialFilters,
    ],
  );

  const operationMode = useMemo(() => {
    return OPERATION_MODE_MAP[operationSelection];
  }, [operationSelection]);

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
    if (
      fieldSelection &&
      (textFilter?.trim().length ||
        inValues?.length ||
        ['True', 'False'].includes(boolSelection))
    ) {
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
    }
  }, [
    fieldSelection,
    textFilter,
    inValues,
    boolSelection,
    operationMode,
    updateFilters,
    operationSelection,
    resetFilters,
  ]);

  const onRemoveFilter = useCallback(
    (id) => {
      if (!(Array.isArray(blockRemove) && blockRemove.includes(id))) {
        updateFilters({
          field: id,
          operator: null,
          value: null,
          callback: removeCallback,
        });
      }
    },
    [blockRemove, removeCallback, updateFilters],
  );

  const clearFilters = useCallback(() => {
    setActiveFilters((prevActive) =>
      prevActive.filter((f) => f.field === 'project_id'),
    );
    resetFilters();
    navigate({
      pathname: location.pathname,
      search: '',
      hash: location.hash,
    });
  }, [location.hash, location.pathname, navigate, resetFilters]);

  const onFieldSelect = useCallback(
    (_, selection) => {
      if (selection === `Click to use: "${fieldFilterValue}"`) {
        // use the fieldFilterValue text input for state, selection is only menu items
        const newFieldOptions = [
          ...(fieldOptionsState || []),
          { value: fieldFilterValue, children: fieldFilterValue },
        ];
        setFieldOptionsState(newFieldOptions);
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
    [fieldFilterValue, fieldOptionsState, setFieldOptionsState],
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
  const filteredFieldOptions = useMemo(() => {
    let newFieldOptions = [...(fieldOptionsState || [])];
    if (fieldInputValue?.length > 0 && isFieldOpen) {
      newFieldOptions = newFieldOptions.filter((menuItem) =>
        menuItem?.value.toLowerCase().includes(fieldFilterValue.toLowerCase()),
      );
      if (
        fieldFilterValue !== '' &&
        !newFieldOptions.map((f) => f.value).includes(fieldFilterValue)
      ) {
        newFieldOptions.push({
          value: fieldFilterValue,
          children: `Click to use: "${fieldFilterValue}"`,
        });
      }
    }
    return newFieldOptions;
  }, [fieldFilterValue, fieldInputValue, fieldOptionsState, isFieldOpen]);

  const filterMode = useMemo(
    () => FILTER_MODE_MAP[fieldSelection],
    [fieldSelection],
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
        ref={toggleRef}
        variant="typeahead"
        aria-label="Field selection menu toggle"
        onClick={() => setIsFieldOpen(!isFieldOpen)}
        isExpanded={isFieldOpen}
        isFullWidth
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={fieldInputValue}
            onChange={onFieldTextInputChange}
            autoComplete="off"
            placeholder="Select a field"
            aria-label="Field selection typeahead input"
          />
          <TextInputGroupUtilities>
            {!!fieldInputValue && (
              <Button
                icon={<TimesIcon aria-hidden />}
                variant="plain"
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldClear();
                }}
                aria-label="Clear input value"
              />
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
        ref={toggleRef}
        onClick={() => setIsOperationOpen(!isOperationOpen)}
        isExpanded={isOperationOpen}
        isFullWidth
      >
        {typeof operationSelection === 'object' && operationSelection !== null
          ? operationSelection.title || 'Select operation'
          : operations[operationSelection]?.opString ||
            operationSelection ||
            'Select operation'}
      </MenuToggle>
    ),
    [isOperationOpen, operationSelection, operations],
  );

  const boolToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        ref={toggleRef}
        onClick={() => setIsBoolOpen(!isBoolOpen)}
        isExpanded={isBoolOpen}
        isFullWidth
      >
        {typeof boolSelection === 'object' && boolSelection !== null
          ? boolSelection.title || 'Select True/False'
          : boolSelection || 'Select True/False'}
      </MenuToggle>
    ),
    [boolSelection, isBoolOpen],
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
