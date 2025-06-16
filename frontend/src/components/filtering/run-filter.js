import {
  Button,
  CardBody,
  Flex,
  FlexItem,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import PropTypes from 'prop-types';
import { useContext } from 'react';

import ActiveFilters from './active-filters';
import MultiValueInput from '../multivalueinput';
import { FilterContext } from '../contexts/filterContext';

const RunFilter = ({ hideFilters }) => {
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

    // Functions
    onBoolSelect,
    onFieldSelect,
    onOperationSelect,
    fieldToggle,
    operationToggle,
    boolToggle,
    onRemoveFilter,
    applyFilter,

    // Memos
    filterMode,
    operationMode,
    operations,
  } = useContext(FilterContext);
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

RunFilter.propTypes = {
  hideFilters: PropTypes.arrayOf(PropTypes.string),
};

export default RunFilter;
