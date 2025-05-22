import {
  Button,
  CardBody,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import { SelectVariant } from '@patternfly/react-core/deprecated';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { STRING_USER_FIELDS, STRING_OPERATIONS } from '../constants';
import PropTypes from 'prop-types';
import useTableFilters from './hooks/useTableFilters';
import ActiveFilters from './active-filters';

const DEFAULT_FIELD = STRING_USER_FIELDS[0];
const DEFAULT_OP = Object.keys(STRING_OPERATIONS)[0];

const UserFilter = ({
  applyFilter,
  isFieldOpen,
  selectedField,
  onFieldSelect,
  isOperationOpen,
  operationSelection,
  onOperationSelect,
  filterValue,
  setIsFieldOpen,
  setIsOperationOpen,
  setFilterValue,
}) => {
  const userToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsFieldOpen(!isFieldOpen)}
        isExpanded={isFieldOpen}
        ref={toggleRef}
      >
        {selectedField}
      </MenuToggle>
    ),
    [isFieldOpen, selectedField, setIsFieldOpen],
  );
  const operationToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsOperationOpen(!isOperationOpen)}
        isExpanded={isOperationOpen}
        ref={toggleRef}
      >
        {operationSelection}
      </MenuToggle>
    ),
    [isOperationOpen, operationSelection, setIsOperationOpen],
  );
  return (
    <Flex grow={{ default: 'grow' }} spaceItems={{ default: 'spaceItemsXs' }}>
      <Flex spaceItems={{ default: 'spaceItemsXs' }}>
        <FlexItem>
          <Select
            key="user-filter"
            aria-label="user-filter-field"
            variant={SelectVariant.single}
            isOpen={isFieldOpen}
            selected={selectedField}
            onToggle={(_, change) => setIsFieldOpen(change)}
            toggle={userToggle}
            onSelect={onFieldSelect}
            defaultValue={DEFAULT_FIELD}
          >
            {STRING_USER_FIELDS.map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
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
            value={filterValue}
            onChange={(_, newValue) => setFilterValue(newValue)}
          />
        </FlexItem>
      </Flex>

      {filterValue && (
        <Flex>
          <FlexItem>
            <Button onClick={applyFilter} variant="control">
              Apply Filter
            </Button>
          </FlexItem>
        </Flex>
      )}
    </Flex>
  );
};

UserFilter.propTypes = {
  applyFilter: PropTypes.func,
  isFieldOpen: PropTypes.bool,
  selectedField: PropTypes.string,
  onFieldSelect: PropTypes.func,
  isOperationOpen: PropTypes.bool,
  operationSelection: PropTypes.string,
  onOperationSelect: PropTypes.func,
  operationToggle: PropTypes.func,
  filterValue: PropTypes.string,
  setIsFieldOpen: PropTypes.func,
  setIsOperationOpen: PropTypes.func,
  setFilterValue: PropTypes.func,
};

const useUserFilter = () => {
  const {
    onFieldSelect,
    onOperationSelect,
    activeFilters,
    fieldSelection,
    setFieldSelection,
    operationSelection,
    setOperationSelection,
    filterValue,
    setFilterValue,
    onRemoveFilter,
    isFieldOpen,
    setIsFieldOpen,
    isOperationOpen,
    setIsOperationOpen,
    applyFilter,
  } = useTableFilters({ fieldOptions: STRING_USER_FIELDS });

  useEffect(() => {
    if (!fieldSelection?.length) {
      setFieldSelection(DEFAULT_FIELD);
      setOperationSelection(DEFAULT_OP);
    }
  }, [fieldSelection, setOperationSelection, setFieldSelection]);

  const filterComponents = (
    <CardBody key="filters">
      <Flex
        alignSelf={{ default: 'alignSelfFlexEnd' }}
        direction={{ default: 'column' }}
        align={{ default: 'alignRight' }}
      >
        <UserFilter
          applyFilter={applyFilter}
          selectedField={fieldSelection?.value}
          onFieldSelect={onFieldSelect}
          isFieldOpen={isFieldOpen}
          setIsFieldOpen={setIsFieldOpen}
          operationSelection={operationSelection}
          onOperationSelect={onOperationSelect}
          isOperationOpen={isOperationOpen}
          setIsOperationOpen={setIsOperationOpen}
          filterValue={filterValue}
          setFilterValue={setFilterValue}
        />
      </Flex>
      <Flex>
        <ActiveFilters
          activeFilters={activeFilters}
          onRemoveFilter={onRemoveFilter}
        />
      </Flex>
    </CardBody>
  );

  return { filterComponents, activeFilters };
};

export default useUserFilter;
