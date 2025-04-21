import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Text,
  Tooltip,
} from '@patternfly/react-core';

const ParamDropdown = (props) => {
  const { defaultValue, handleSelect, tooltip, dropdownItems } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || 'Group data by?');

  const dropOnSelect = (event) => {
    setIsOpen(!isOpen);
    handleSelect(event.target.innerText);
    setValue(event.target.innerText);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, setValue]);

  return (
    // TODO this formatting of the dropdown labels is ugly as hell
    <React.Fragment>
      <div data-id="widget-param-dropdown">
        <Text component="h3">{tooltip}</Text>
        <Tooltip content={tooltip}>
          <Dropdown
            isOpen={isOpen}
            onSelect={dropOnSelect}
            onOpenChange={() => setIsOpen(false)}
            toggle={(toggleRef) => (
              <MenuToggle
                id="toggle-dropdown"
                ref={toggleRef}
                onClick={() => setIsOpen(!isOpen)}
                isExpanded={isOpen}
              >
                {value}
              </MenuToggle>
            )}
            ouiaId="BasicDropdown"
            shouldFocusToggleOnSelect
          >
            <DropdownList>
              {dropdownItems &&
                dropdownItems.map((item) => (
                  <DropdownItem onClick={dropOnSelect} key={item}>
                    {item}
                  </DropdownItem>
                ))}
              <></>
            </DropdownList>
          </Dropdown>
        </Tooltip>
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
