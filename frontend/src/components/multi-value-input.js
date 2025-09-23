import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Label,
  LabelGroup,
  Button,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

const MultiValueInput = ({
  onAddValue,
  onRemoveValue,
  onValuesChange,
  style,
}) => {
  const [values, setValues] = useState([]);
  const [value, setValue] = useState('');

  const handleTextInputChange = (_, event_value) => {
    setValue(event_value);
  };

  const handleItemRemove = (item) => {
    const newValues = values.filter((v) => v !== item);
    setValues(newValues);
    if (onRemoveValue) {
      onRemoveValue(item);
    }
    if (onValuesChange) {
      onValuesChange(newValues);
    }
  };

  const handleItemAdd = (item) => {
    if (!values.includes(item)) {
      const newValues = values.concat(item);
      setValues([...values, item]);
      if (onAddValue) {
        onAddValue(value);
      }
      if (onValuesChange) {
        onValuesChange(newValues);
      }
    }
    setValue('');
  };

  const handleEnter = () => {
    if (value.length) {
      handleItemAdd(value);
    }
  };

  const handleKeyPress = (event) => {
    switch (event.key) {
      case 'Enter':
        handleEnter();
        break;
    }
  };

  return (
    <>
      <TextInputGroup>
        <TextInputGroupMain
          value={value}
          placeholder="Type any value and hit <Enter>"
          onChange={handleTextInputChange}
          onKeyDown={handleKeyPress}
          style={{ ...style, minWidth: '240px' }}
          type="text"
        >
          <LabelGroup aria-label="Current selections">
            {values.map((item, index) => (
              <Label
                variant="outline"
                key={index}
                onClose={() => handleItemRemove(item)}
              >
                {item}
              </Label>
            ))}
          </LabelGroup>
        </TextInputGroupMain>
        <TextInputGroupUtilities>
          {(values.length > 0 || !!value) && (
            <Button
              icon={<TimesIcon aria-hidden />}
              variant="plain"
              onClick={() => {
                setValues([]);
                setValue('');
              }}
              aria-label="Clear input value"
            />
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </>
  );
};

MultiValueInput.propTypes = {
  onAddValue: PropTypes.func,
  onRemoveValue: PropTypes.func,
  onValuesChange: PropTypes.func,
  style: PropTypes.object,
};

export default MultiValueInput;
