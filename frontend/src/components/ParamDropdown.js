import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  MenuToggle,
  Content,
  SelectList,
  SelectOption,
  Select,
} from '@patternfly/react-core';

const ParamDropdown = ({
  defaultValue,
  handleSelect,
  tooltip,
  dropdownItems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || 'Group data by?');

  const dropOnSelect = (_event, itemId) => {
    setIsOpen(false);
    handleSelect(itemId);
    setValue(itemId);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, setValue]);

  return (
    <React.Fragment>
      <div data-id="widget-param-dropdown">
        <Content component="h3">{tooltip}</Content>
        <Select
          isOpen={isOpen}
          selected={value}
          onSelect={dropOnSelect}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsOpen(!isOpen)}
              isExpanded={isOpen}
              isDisabled={dropdownItems.length === 0}
            >
              {value}
            </MenuToggle>
          )}
        >
          <SelectList>
            {dropdownItems.map((item) => (
              <SelectOption value={item} key={item}>
                {item}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      </div>
    </React.Fragment>
  );
};

ParamDropdown.propTypes = {
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dropdownItems: PropTypes.array,
  handleSelect: PropTypes.func,
  tooltip: PropTypes.string,
};

export default ParamDropdown;
