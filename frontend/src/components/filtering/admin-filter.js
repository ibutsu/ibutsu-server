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

import { STRING_OPERATIONS } from '../../constants';
import ActiveFilters from './active-filters';
import { useContext } from 'react';
import { FilterContext } from '../contexts/filter-context';

const AdminFilter = () => {
  const {
    applyFilter,
    isFieldOpen,
    selectedField,
    onFieldSelect,
    isOperationOpen,
    operationSelection,
    onOperationSelect,
    textFilter,
    setIsFieldOpen,
    setIsOperationOpen,
    setTextFilter,
    filteredFieldOptions,
    activeFilters,
    onRemoveFilter,
    fieldToggle,
    operationToggle,
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
                key="user-filter"
                aria-label="user-filter-field"
                isOpen={isFieldOpen}
                selected={selectedField}
                onOpenChange={(isOpen) => setIsFieldOpen(isOpen)}
                toggle={fieldToggle}
                onSelect={onFieldSelect}
              >
                <SelectList>
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
                key="operation-select"
                id="operation-select"
                aria-label="operation-select"
                isOpen={isOperationOpen}
                selected={operationSelection}
                onSelect={onOperationSelect}
                onOpenChange={() => setIsOperationOpen(false)}
                toggle={operationToggle}
              >
                <SelectList>
                  {Object.keys(STRING_OPERATIONS).map((option) => (
                    <SelectOption key={option} value={option}>
                      {STRING_OPERATIONS[option].opString}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </FlexItem>
            <FlexItem>
              <TextInput
                type="text"
                id="textSelection"
                placeholder="Type in value"
                value={textFilter}
                onChange={(_, newValue) => setTextFilter(newValue)}
              />
            </FlexItem>
          </Flex>
          <Flex>
            <FlexItem>
              <Button onClick={applyFilter}>Apply Filter</Button>
            </FlexItem>
          </Flex>
        </Flex>
      </Flex>
      <Flex>
        <ActiveFilters
          activeFilters={activeFilters}
          onRemoveFilter={onRemoveFilter}
          transferTarget={null}
        />
      </Flex>
    </CardBody>
  );
};

export default AdminFilter;
