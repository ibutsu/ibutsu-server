import {
	Button,
	CardBody,
	Chip,
	ChipGroup,
	Flex,
	FlexItem,
	MenuToggle,
	SelectList,
	TextInput,
	TextInputGroup,
	TextInputGroupMain,
	TextInputGroupUtilities
} from '@patternfly/react-core';
import {
	Select,
	SelectOption
} from '@patternfly/react-core/deprecated';
import PropTypes from 'prop-types';
import { useCallback, useContext, useEffect, useState } from 'react';
import { TimesIcon } from '@patternfly/react-icons';

import MultiValueInput from '../multivalueinput';
import ActiveFilters from './active-filters';

import { FilterContext } from '../contexts/filterContext';
import { RESULT_STATES } from '../../constants';

const RESULT_SELECT_OPTIONS = Object.keys(RESULT_STATES);

const ResultFilter = ({ hideFilters, runs }) => {
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
    fieldToggle,
    operationToggle,
    boolToggle,
    onRemoveFilter,
    updateFilters,
    resetFilters,

    // Memos
    filterMode,
    operationMode,
    operations,
  } = useContext(FilterContext);

  const [runSelection, setRunSelection] = useState([]);
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [runInputValue, setRunInputValue] = useState('');
  const [runFilterValue, setRunFilterValue] = useState('');

  const [filteredRuns, setFilteredRuns] = useState([]);

  const [resultSelection, setResultSelection] = useState([]);
  const [isResultOpen, setIsResultOpen] = useState(false);

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
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            onClick={() => setIsResultOpen(!isResultOpen)}
            isExpanded={isResultOpen}
            placeholder="Select 1 or multiple results"
          >
            <ChipGroup aria-label="Current selections">
              {resultSelection?.map((selection, index) => (
                <Chip
                  key={index}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onResultSelect(ev, selection);
                  }}
                >
                  {selection}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {!!resultSelection && (
              <Button
                variant="plain"
                onClick={onResultClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
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
                variant="plain"
                onClick={() => {
                  onRunClear();
                }}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
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
            <ChipGroup aria-label="Current selections">
              {runSelection?.map((selection, index) => (
                <Chip
                  key={index}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onRunSelect(ev, selection);
                  }}
                >
                  {selection}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {runSelection?.length > 0 && (
              <Button
                variant="plain"
                onClick={() => {
                  onRunClear();
                }}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
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
              >
                <SelectList id="select-typeahead-listbox">
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
              >
                <SelectList>
                  {Object.keys(operations).map((option, index) => (
                    <SelectOption key={index} value={option}>
                      {option}
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
              {filterMode === 'text' && operationMode === 'multi' && (
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
                >
                  <SelectList>
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
                >
                  <SelectList>
                    {RESULT_SELECT_OPTIONS.map((option, index) => (
                      <SelectOption key={index} value={option}>
                        {option}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
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
            transferTarget="reports"
          />
        </Flex>
      </Flex>
    </CardBody>
  );
};

ResultFilter.propTypes = {
  hideFilters: PropTypes.arrayOf(PropTypes.string),
  runs: PropTypes.arrayOf(PropTypes.string),
};

export default ResultFilter;
