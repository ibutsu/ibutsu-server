import {
  Label,
  LabelGroup,
  Button,
  CardBody,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';

import PropTypes from 'prop-types';
import { useCallback, useContext, useEffect, useState } from 'react';
import { TimesIcon } from '@patternfly/react-icons';

import MultiValueInput from '../multi-value-input';
import ActiveFilters from './active-filters';

import { FilterContext } from '../contexts/filter-context';
import { IbutsuContext } from '../contexts/ibutsu-context';
import { RESULT_STATES } from '../../constants';
import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';
import { filtersToAPIParams } from '../../utilities';

const RESULT_SELECT_OPTIONS = Object.keys(RESULT_STATES);

const ResultFilter = ({ hideFilters, runs, maxHeight = '600px' }) => {
  const {
    // States
    activeFilters,
    boolSelection,
    fieldSelection,
    filteredFieldOptions,
    setInValues,
    isFieldOpen,
    setIsFieldOpen,
    isOperationOpen,
    setIsOperationOpen,
    operationSelection,
    textFilter,
    setTextFilter,
    isBoolOpen,
    setIsBoolOpen,
    inValues,

    // Functions
    onBoolSelect,
    onFieldSelect,
    onOperationSelect,
    onRemoveFilter,
    updateFilters,
    resetFilters,

    // Memos
    filterMode,
    operationMode,
    operations,
    fieldToggle,
    operationToggle,
    boolToggle,
  } = useContext(FilterContext);

  const { primaryObject } = useContext(IbutsuContext);

  const [runSelection, setRunSelection] = useState([]);
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [runInputValue, setRunInputValue] = useState('');
  const [runFilterValue, setRunFilterValue] = useState('');

  const [filteredRuns, setFilteredRuns] = useState([]);

  const [resultSelection, setResultSelection] = useState([]);
  const [isResultOpen, setIsResultOpen] = useState(false);

  // Dynamic metadata values
  const [valueOptions, setValueOptions] = useState([]);
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (fieldSelection && fieldSelection.startsWith('metadata.')) {
      setLoadError(null);
      // Filter out project_id since we pass it as 'project' parameter
      const filtersWithoutProject = activeFilters.filter(
        (f) => f.field !== 'project_id',
      );
      const apiFilter = filtersToAPIParams(filtersWithoutProject).join(',');
      const projectId = primaryObject ? primaryObject.id : '';

      // Build params object
      const params = {
        group_field: fieldSelection,
        project: projectId,
        days: 90,
      };

      // Only add additional_filters if there are filters to add
      if (apiFilter) {
        params.additional_filters = apiFilter;
      }

      HttpClient.get(
        [Settings.serverUrl, 'widget', 'result-aggregator'],
        params,
      )
        .then((response) => HttpClient.handleResponse(response))
        .then((data) => {
          setValueOptions(data || []);
        })
        .catch((error) => {
          console.error('Error fetching dynamic values:', error);
          setValueOptions([]);
          setLoadError('Error loading values');
        });
    } else {
      setValueOptions([]);
      setLoadError(null);
    }
  }, [fieldSelection, activeFilters, primaryObject]);

  const onRunSelect = useCallback(
    (_, selection) => {
      if (operationMode !== 'multi') {
        setRunSelection([selection]);
        setRunInputValue(selection);
        setRunFilterValue('');
        setIsRunOpen(false);
      } else if (runSelection.includes(selection)) {
        setRunSelection([...runSelection].filter((item) => item !== selection));
      } else {
        setRunSelection([...runSelection, selection]);
      }
    },
    [operationMode, runSelection],
  );

  const onRunTextInputChange = useCallback((_, value) => {
    setRunInputValue(value);
    setRunFilterValue(value);
  }, []);

  const onRunClear = useCallback(() => {
    setRunSelection([]);
    setRunInputValue('');
    setRunFilterValue('');
  }, []);

  const onResultSelect = useCallback(
    (_, selection) => {
      if (operationMode !== 'multi') {
        setResultSelection(selection);
        setIsResultOpen(false);
      } else if (resultSelection.includes(selection)) {
        setResultSelection(
          [...resultSelection].filter((item) => item !== selection),
        );
      } else {
        setResultSelection([...resultSelection, selection]);
      }
    },
    [operationMode, resultSelection],
  );

  const applyFilter = useCallback(() => {
    if (
      fieldSelection &&
      (textFilter?.trim().length ||
        runSelection?.length ||
        resultSelection?.length ||
        inValues?.length ||
        ['True', 'False'].includes(boolSelection))
    ) {
      let value = textFilter.trim();
      if (filterMode === 'result' && operationMode !== 'bool') {
        value =
          operationMode === 'multi'
            ? resultSelection?.join(';')
            : resultSelection;
      } else if (filterMode === 'run' && operationMode !== 'bool') {
        value =
          operationMode === 'multi' ? runSelection?.join(';') : runSelection;
      } else if (operationMode === 'multi') {
        value = inValues.map((item) => item.trim()).join(';');
      } else if (operationMode === 'bool') {
        value = boolSelection;
      }
      updateFilters({
        field: fieldSelection,
        operator: operationSelection,
        value: value,
        callback: () => {
          resetFilters();
          setRunInputValue('');
          setResultSelection([]);
          setRunSelection([]);
        },
      });
    }
  }, [
    textFilter,
    filterMode,
    operationMode,
    resultSelection,
    runSelection,
    inValues,
    boolSelection,
    updateFilters,
    fieldSelection,
    operationSelection,
    resetFilters,
  ]);

  const onResultClear = useCallback(() => {
    setResultSelection([]);
    setIsResultOpen(false);
  }, [setIsResultOpen, setResultSelection]);

  const resultToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsResultOpen(!isResultOpen)}
        isExpanded={isResultOpen}
        isFullWidth
        placeholder="Select a result"
        ref={toggleRef}
        ouiaId="result-filter-result-toggle"
      >
        {resultSelection.length !== 0 ? resultSelection : 'Select a result'}
      </MenuToggle>
    ),
    [isResultOpen, resultSelection, setIsResultOpen],
  );

  const resultMultiToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        variant="typeahead"
        onClick={() => setIsResultOpen(!isResultOpen)}
        isExpanded={isResultOpen}
        isFullWidth
        placeholder="Select a result"
        ref={toggleRef}
        ouiaId="result-filter-result-multi-toggle"
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            onClick={() => setIsResultOpen(!isResultOpen)}
            isExpanded={isResultOpen}
            placeholder="Select 1 or multiple results"
          >
            <LabelGroup aria-label="Current selections">
              {resultSelection?.map((selection, index) => (
                <Label
                  variant="outline"
                  key={index}
                  onClose={(ev) => {
                    ev.stopPropagation();
                    onResultSelect(ev, selection);
                  }}
                  ouiaId={`result-filter-result-label-${index}`}
                >
                  {selection}
                </Label>
              ))}
            </LabelGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {!!resultSelection && (
              <Button
                icon={<TimesIcon aria-hidden />}
                variant="plain"
                onClick={onResultClear}
                aria-label="Clear input value"
                ouiaId="result-filter-result-clear-button"
              />
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [
      isResultOpen,
      resultSelection,
      setIsResultOpen,
      onResultSelect,
      onResultClear,
    ],
  );

  const runToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        variant="typeahead"
        onClick={() => setIsRunOpen(!isRunOpen)}
        isExpanded={isRunOpen}
        isFullWidth
        innerRef={toggleRef}
        ouiaId="result-filter-run-toggle"
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={runInputValue}
            onClick={() => setIsRunOpen(!isRunOpen)}
            onChange={onRunTextInputChange}
            autoComplete="off"
            placeholder="Select a run"
            role="combobox"
            isExpanded={isRunOpen}
          />
          <TextInputGroupUtilities>
            {!!runInputValue && (
              <Button
                icon={<TimesIcon aria-hidden />}
                variant="plain"
                onClick={() => {
                  onRunClear();
                }}
                aria-label="Clear input value"
                ouiaId="result-filter-run-clear-button"
              />
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [isRunOpen, runInputValue, onRunTextInputChange, setIsRunOpen, onRunClear],
  );

  const runMultiToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        variant="typeahead"
        onClick={() => setIsRunOpen(!isRunOpen)}
        isExpanded={isRunOpen}
        isFullWidth
        innerRef={toggleRef}
        ouiaId="result-filter-run-multi-toggle"
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={runInputValue}
            onClick={() => setIsRunOpen(!isRunOpen)}
            onChange={onRunTextInputChange}
            autoComplete="off"
            placeholder="Select 1 or multiple runs"
            role="combobox"
            isExpanded={isRunOpen}
          >
            <LabelGroup aria-label="Current selections">
              {runSelection?.map((selection, index) => (
                <Label
                  variant="outline"
                  key={index}
                  onClose={(ev) => {
                    ev.stopPropagation();
                    onRunSelect(ev, selection);
                  }}
                  ouiaId={`result-filter-run-label-${index}`}
                >
                  {selection}
                </Label>
              ))}
            </LabelGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {runSelection?.length > 0 && (
              <Button
                icon={<TimesIcon aria-hidden />}
                variant="plain"
                onClick={() => {
                  onRunClear();
                }}
                aria-label="Clear input value"
                ouiaId="result-filter-run-clear-multi-button"
              />
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [
      isRunOpen,
      runInputValue,
      onRunTextInputChange,
      runSelection,
      setIsRunOpen,
      onRunSelect,
      onRunClear,
    ],
  );

  // filter run options based on input
  useEffect(() => {
    if (fieldSelection === 'run_id' && runs?.length) {
      let newSelectOptionsRun = [...runs];
      if (runInputValue) {
        newSelectOptionsRun = runs.filter((menuItem) =>
          menuItem.toLowerCase().includes(runFilterValue.toLowerCase()),
        );
      }
      setFilteredRuns(newSelectOptionsRun);
    }
  }, [fieldSelection, runFilterValue, runInputValue, runs]);

  return (
    <CardBody key="filters">
      <Flex
        alignSelf={{ default: 'alignSelfFlexEnd' }}
        direction={{ default: 'column' }}
        align={{ default: 'alignRight' }}
      >
        <Flex
          grow={{ default: 'grow' }}
          spaceItems={{ default: 'spaceItemsXs' }}
        >
          <Flex spaceItems={{ default: 'spaceItemsXs' }}>
            <FlexItem>
              <Select
                id="typeahead-select"
                selected={fieldSelection}
                isOpen={isFieldOpen}
                onSelect={onFieldSelect}
                key="field"
                onOpenChange={() => setIsFieldOpen(false)}
                toggle={fieldToggle}
                ouiaId="result-filter-field-select"
              >
                <SelectList
                  id="select-typeahead-listbox"
                  style={{ maxHeight, overflowY: 'auto' }}
                >
                  {filteredFieldOptions?.map((option) => (
                    <SelectOption
                      key={option.value}
                      value={option.value}
                      description={option.value}
                    >
                      {option.children}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </FlexItem>
            <FlexItem>
              <Select
                id="single-select"
                isOpen={isOperationOpen}
                selected={operationSelection}
                onSelect={(_, value) => {
                  onOperationSelect(_, value);
                  setResultSelection([]);
                  setRunSelection([]);
                }}
                onOpenChange={() => setIsOperationOpen(false)}
                key="operation"
                toggle={operationToggle}
                ouiaId="result-filter-operation-select"
              >
                <SelectList style={{ maxHeight, overflowY: 'auto' }}>
                  {Object.keys(operations).map((option, index) => (
                    <SelectOption key={index} value={option}>
                      {operations[option].opString}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </FlexItem>
            <FlexItem>
              {operationMode === 'bool' && (
                <Select
                  id="single-select"
                  isOpen={isBoolOpen}
                  selected={boolSelection}
                  onSelect={onBoolSelect}
                  onOpenChange={() => setIsBoolOpen(false)}
                  toggle={boolToggle}
                  ouiaId="result-filter-bool-select"
                >
                  <SelectList style={{ maxHeight, overflowY: 'auto' }}>
                    {['True', 'False'].map((option, index) => (
                      <SelectOption key={index} value={option}>
                        {option}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              )}
              {filterMode === 'text' && valueOptions.length > 0 && (
                <Select
                  id="value-select"
                  isOpen={isValueOpen}
                  selected={operationMode === 'multi' ? inValues : textFilter}
                  onSelect={(e, selection) => {
                    if (operationMode === 'multi') {
                      const newValues = inValues.includes(selection)
                        ? inValues.filter((v) => v !== selection)
                        : [...inValues, selection];
                      setInValues(newValues);
                    } else {
                      setTextFilter(selection);
                      setIsValueOpen(false);
                    }
                  }}
                  onOpenChange={() => setIsValueOpen(false)}
                  toggle={(toggleRef) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setIsValueOpen(!isValueOpen)}
                      isExpanded={isValueOpen}
                    >
                      {operationMode === 'multi'
                        ? `${inValues.length} selected`
                        : textFilter || 'Select value'}
                    </MenuToggle>
                  )}
                >
                  <SelectList style={{ maxHeight, overflowY: 'auto' }}>
                    {valueOptions.map((option, index) => (
                      <SelectOption
                        key={index}
                        value={option._id}
                        hasCheckbox={operationMode === 'multi'}
                        isSelected={
                          operationMode === 'multi'
                            ? inValues.includes(option._id)
                            : textFilter === option._id
                        }
                        description={`${option.count} results`}
                      >
                        {option._id}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              )}
              {filterMode === 'text' &&
                operationMode === 'single' &&
                valueOptions.length === 0 && (
                  <TextInput
                    type="text"
                    id="textSelection"
                    placeholder="Type in value"
                    value={textFilter}
                    onChange={(_, newValue) => setTextFilter(newValue)}
                    style={{ height: 'inherit' }}
                    ouiaId="result-filter-text-input"
                  />
                )}
              {filterMode === 'text' &&
                operationMode === 'multi' &&
                valueOptions.length === 0 && (
                  <MultiValueInput
                    onValuesChange={(values) => setInValues(values)}
                    style={{ height: 'inherit' }}
                  />
                )}
              {filterMode === 'run' && operationMode !== 'bool' && (
                <Select
                  id="typeahead-select"
                  isOpen={isRunOpen}
                  selected={runSelection}
                  onSelect={onRunSelect}
                  onOpenChange={() => setIsRunOpen(false)}
                  toggle={
                    operationMode === 'multi' ? runMultiToggle : runToggle
                  }
                  ouiaId="result-filter-run-select"
                >
                  <SelectList style={{ maxHeight, overflowY: 'auto' }}>
                    {filteredRuns?.length === 0 && (
                      <SelectOption isDisabled={true}>
                        {`No runs found for "${runFilterValue}"`}
                      </SelectOption>
                    )}
                    {filteredRuns?.map((option, index) => (
                      <SelectOption key={index} value={option}>
                        {option}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              )}
              {filterMode === 'result' && operationMode !== 'bool' && (
                <Select
                  id="single-select"
                  isOpen={isResultOpen}
                  selected={resultSelection}
                  onSelect={onResultSelect}
                  onOpenChange={() => setIsResultOpen(false)}
                  toggle={
                    operationMode === 'multi' ? resultMultiToggle : resultToggle
                  }
                  ouiaId="result-filter-result-select"
                >
                  <SelectList style={{ maxHeight, overflowY: 'auto' }}>
                    {RESULT_SELECT_OPTIONS.map((option, index) => (
                      <SelectOption key={index} value={option}>
                        {option}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              )}
              {loadError && (
                <div
                  style={{
                    color: 'var(--pf-v6-global--danger-color--100)',
                    fontSize: 'var(--pf-v6-global--FontSize--sm)',
                    marginTop: '0.25rem',
                  }}
                >
                  {loadError}
                </div>
              )}
            </FlexItem>
          </Flex>
          <FlexItem>
            <Button ouiaId="filter-table-apply-button" onClick={applyFilter}>
              Apply Filter
            </Button>
          </FlexItem>
        </Flex>
        <Flex>
          <ActiveFilters
            activeFilters={activeFilters}
            onRemoveFilter={onRemoveFilter}
            hideFilters={hideFilters}
            transferTarget={null}
          />
        </Flex>
      </Flex>
    </CardBody>
  );
};

ResultFilter.propTypes = {
  hideFilters: PropTypes.arrayOf(PropTypes.string),
  runs: PropTypes.arrayOf(PropTypes.string),
  maxHeight: PropTypes.string,
};

export default ResultFilter;
