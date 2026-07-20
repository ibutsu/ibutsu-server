import { useEffect, useState } from 'react';
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
  ouiaId = 'param-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userSelection, setUserSelection] = useState(null);

  useEffect(() => {
    const resetSelection = async () => {
      setUserSelection(null);
    };
    resetSelection();
  }, [defaultValue]);

  const value = userSelection ?? defaultValue ?? 'Group data by?';

  const dropOnSelect = (_event, itemId) => {
    setIsOpen(false);
    handleSelect(itemId);
    setUserSelection(itemId);
  };

  return (
    <>
      <div
        className="ibutsu-param-dropdown"
        data-ouia-component-id={`${ouiaId}-wrapper`}
      >
        <Content component="h3">{tooltip}</Content>
        <Select
          isOpen={isOpen}
          selected={value}
          onSelect={dropOnSelect}
          ouiaId={`${ouiaId}-select`}
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
    </>
  );
};

export default ParamDropdown;
