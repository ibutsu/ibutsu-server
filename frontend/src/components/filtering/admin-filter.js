import {
	Button,
	CardBody,
	Flex,
	FlexItem,
	SelectList,
	TextInput
} from '@patternfly/react-core';
import {
	SelectVariant,
	Select,
	SelectOption
} from '@patternfly/react-core/deprecated';

import { STRING_OPERATIONS } from '../../constants';
import ActiveFilters from './active-filters';
import { useContext } from 'react';
import { FilterContext } from '../contexts/filterContext';

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
    operationToggle,
    fieldToggle,
    filteredFieldOptions,
    activeFilters,
    onRemoveFilter,
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
                variant={SelectVariant.single}
                isOpen={isFieldOpen}
                selected={selectedField}
                onToggle={(_event, _, change) => setIsFieldOpen(change)}
                toggle={fieldToggle}
                onSelect={onFieldSelect}
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
                      {option}
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
