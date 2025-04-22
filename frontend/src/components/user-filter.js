import {
  Badge,
  Button,
  Chip,
  ChipGroup,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import { SelectVariant } from '@patternfly/react-core/deprecated';
import React, { useCallback, useMemo, useState } from 'react';

import { STRING_USER_FIELDS, STRING_OPERATIONS } from '../constants';
import PropTypes from 'prop-types';

const DEFAULT_FIELD = STRING_USER_FIELDS[0];
const DEFAULT_OP = Object.keys(STRING_OPERATIONS)[0];

const UserFilterComponent = ({
  applyFilter,
  isFieldOpen,
  selectedField,
  userToggle,
  onFieldSelect,
  isOperationOpen,
  operationSelection,
  onOperationSelect,
  operationToggle,
  filterValue,
  setIsFieldOpen,
  setIsOperationOpen,
  setFilterValue,
}) => (
  <React.Fragment>
    <Flex>
      <Flex columnGap={{ default: 'columnGapSm' }}>
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
          >
            {STRING_USER_FIELDS.map((option) => (
              <SelectOption
                key={option.value}
                id={option.value}
                value={option}
                ref={null}
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
  </React.Fragment>
);

UserFilterComponent.propTypes = {
  applyFilter: PropTypes.func,
  isFieldOpen: PropTypes.bool,
  selectedField: PropTypes.string,
  userToggle: PropTypes.func,
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
  // Provide a rich user filter, like meta filter but not as dynamic in the fields

  const [selectedField, setSelectedField] = useState(DEFAULT_FIELD);
  const [isFieldOpen, setIsFieldOpen] = useState(false);

  const [operationSelection, setOperationSelection] = useState(DEFAULT_OP);
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const [filterValue, setFilterValue] = useState('');

  const [activeFilters, setActiveFilters] = useState({});

  const onFieldSelect = useCallback((_, selection) => {
    setSelectedField(selection);
    setFilterValue('');
    setIsFieldOpen(false);
  }, []);

  const onOperationSelect = useCallback((_, selection) => {
    setOperationSelection(selection);
    setIsOperationOpen(false);
  }, []);

  const updateFilters = useCallback(
    (name, operator, value, callback) => {
      let newFilters = { ...activeFilters };
      if (!value) {
        delete newFilters[name];
      } else {
        newFilters[name] = { op: operator, val: value };
      }
      setActiveFilters(newFilters);
      callback();
    },
    [activeFilters],
  );

  const applyFilter = useCallback(() => {
    updateFilters(
      selectedField.value,
      operationSelection,
      filterValue.trim(),
      () => {
        setSelectedField(DEFAULT_FIELD);
        setOperationSelection(DEFAULT_OP);
        setFilterValue('');
      },
    );
  }, [selectedField, filterValue, operationSelection, updateFilters]);

  const userToggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        onClick={() => setIsFieldOpen(!isFieldOpen)}
        isExpanded={isFieldOpen}
        ref={toggleRef}
      >
        {selectedField.children}
      </MenuToggle>
    ),
    [selectedField, isFieldOpen],
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
    [isOperationOpen, operationSelection],
  );

  const filterComponents = (
    <UserFilterComponent
      applyFilter={applyFilter}
      userToggle={userToggle}
      selectedField={selectedField.children}
      onFieldSelect={onFieldSelect}
      isFieldOpen={isFieldOpen}
      setIsFieldOpen={setIsFieldOpen}
      operationSelection={operationSelection}
      operationToggle={operationToggle}
      onOperationSelect={onOperationSelect}
      isOperationOpen={isOperationOpen}
      setIsOperationOpen={setIsOperationOpen}
      filterValue={filterValue}
      setFilterValue={setFilterValue}
    />
  );

  const activeFilterComponents = useMemo(
    () => (
      <React.Fragment>
        {Object.keys(activeFilters).length > 0 && (
          <Flex style={{ marginTop: '1rem', fontWeight: 'normal' }}>
            <Flex>
              <FlexItem style={{ marginBottom: '0.5rem' }}>
                Active filters
              </FlexItem>
            </Flex>
            <Flex grow={{ default: 'grow' }}>
              {Object.keys(activeFilters).map((key) => (
                <FlexItem
                  style={{ marginBottom: '0.5rem' }}
                  spacer={{ default: 'spacerXs' }}
                  key={key}
                >
                  <ChipGroup categoryName={key}>
                    <Chip
                      badge={
                        <Badge isRead={true}>{activeFilters[key]['op']}</Badge>
                      }
                      onClick={() => updateFilters(key, null, null, () => {})}
                    >
                      {typeof activeFilters[key] === 'object' && (
                        <React.Fragment>
                          {activeFilters[key]['val']}
                        </React.Fragment>
                      )}
                      {typeof activeFilters[key] !== 'object' &&
                        activeFilters[key]}
                    </Chip>
                  </ChipGroup>
                </FlexItem>
              ))}
            </Flex>
          </Flex>
        )}
      </React.Fragment>
    ),

    [activeFilters, updateFilters],
  );

  return { filterComponents, activeFilterComponents, activeFilters };
};

export default useUserFilter;
