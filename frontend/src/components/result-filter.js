import {
  Flex,
  FlexItem,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import MultiValueInput from './multivalueinput';
import PropTypes from 'prop-types';
import React from 'react';

const ResultFilter = React.memo(function ResultFilter({
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
  setIsBoolOpen,
  setIsFieldOpen,
  setIsOperationOpen,
  setTextFilter,
  setResultSelection,
  setRunSelection,
  isRunOpen,
  runSelection,
  onRunSelect,
  runToggle,
  runMultiToggle,
  isResultOpen,
  resultSelection,
  onResultSelect,
  resultToggle,
  resultMultiToggle,
  runFilterValue,
  setIsRunOpen,
  filteredRuns = [],
  setIsResultOpen,
}) {
  return (
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
            {filteredFieldOptions.map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
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
            toggle={operationMode === 'multi' ? runMultiToggle : runToggle}
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
              {[
                'passed',
                'xpassed',
                'failed',
                'xfailed',
                'skipped',
                'error',
              ].map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        )}
      </FlexItem>
    </Flex>
  );
});

ResultFilter.propTypes = {
  fieldSelection: PropTypes.string,
  isFieldOpen: PropTypes.bool,
  onFieldSelect: PropTypes.func,
  fieldToggle: PropTypes.func,
  filteredFieldOptions: PropTypes.arrayOf(PropTypes.string),
  isOperationOpen: PropTypes.bool,
  operationSelection: PropTypes.string,
  onOperationSelect: PropTypes.func,
  operationToggle: PropTypes.func,
  operations: PropTypes.object,
  operationMode: PropTypes.string,
  isBoolOpen: PropTypes.bool,
  boolSelection: PropTypes.string,
  onBoolSelect: PropTypes.func,
  boolToggle: PropTypes.func,
  filterMode: PropTypes.string,
  textFilter: PropTypes.string,
  setInValues: PropTypes.func,
  setIsBoolOpen: PropTypes.func,
  setIsFieldOpen: PropTypes.func,
  setIsOperationOpen: PropTypes.func,
  setTextFilter: PropTypes.func,
  setResultSelection: PropTypes.func,
  setRunSelection: PropTypes.func,
  isRunOpen: PropTypes.bool,
  runSelection: PropTypes.arrayOf(PropTypes.string),
  onRunSelect: PropTypes.func,
  runToggle: PropTypes.func,
  runMultiToggle: PropTypes.func,
  isResultOpen: PropTypes.bool,
  resultSelection: PropTypes.arrayOf(PropTypes.string),
  onResultSelect: PropTypes.func,
  resultToggle: PropTypes.func,
  resultMultiToggle: PropTypes.func,
  runFilterValue: PropTypes.string,
  setIsRunOpen: PropTypes.func,
  filteredRuns: PropTypes.arrayOf(PropTypes.string),
  setIsResultOpen: PropTypes.func,
};

export default ResultFilter;
