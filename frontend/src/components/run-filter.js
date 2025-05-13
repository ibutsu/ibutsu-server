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

const RunFilter = React.memo(function RunFilter({
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
            {filteredFieldOptions?.map((option, index) => (
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
          onSelect={onOperationSelect}
          onOpenChange={() => setIsOperationOpen(false)}
          key="operation"
          toggle={operationToggle}
        >
          <SelectList>
            {Object.keys(operations)?.map((option, index) => (
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
        {operationMode === 'multi' && (
          <MultiValueInput
            onValuesChange={(values) => setInValues(values)}
            style={{ height: 'inherit' }}
          />
        )}
      </FlexItem>
    </Flex>
  );
});

RunFilter.propTypes = {
  fieldSelection: PropTypes.string,
  isFieldOpen: PropTypes.bool.isRequired,
  setIsFieldOpen: PropTypes.func.isRequired,
  onFieldSelect: PropTypes.func.isRequired,
  fieldToggle: PropTypes.func.isRequired,
  filteredFieldOptions: PropTypes.arrayOf(PropTypes.string),

  operationSelection: PropTypes.string.isRequired,
  isOperationOpen: PropTypes.bool.isRequired,
  setIsOperationOpen: PropTypes.func.isRequired,
  onOperationSelect: PropTypes.func.isRequired,
  operationToggle: PropTypes.func.isRequired,
  operations: PropTypes.object,
  operationMode: PropTypes.oneOf(['single', 'multi', 'bool']).isRequired,

  boolSelection: PropTypes.string,
  isBoolOpen: PropTypes.bool,
  setIsBoolOpen: PropTypes.func,
  onBoolSelect: PropTypes.func,
  boolToggle: PropTypes.func,

  filterMode: PropTypes.string,
  textFilter: PropTypes.string,
  setInValues: PropTypes.func,
  setTextFilter: PropTypes.func,
};

export default RunFilter;
