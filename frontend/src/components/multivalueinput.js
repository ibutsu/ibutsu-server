import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Chip,
  ChipGroup,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';


const MultiValueInput = (props) => {
  const {
      onAddValue,
      onRemoveValue,
      onValuesChange,
      style,
    } = props;

  const [values, setValues] = useState([]);
  const [value, setValue] = useState('');

  const handleTextInputChange = (_event, event_value) => {
    setValue(event_value);
  };

  const handleItemRemove = (item) => {
    const newValues = values.filter(v => v !== item);
    setValues(newValues);
    if (onRemoveValue) {
      onRemoveValue(item);
    }
    if (onValuesChange){
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
    setValue('')
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
      <React.Fragment>
        <TextInputGroup>
          <TextInputGroupMain
            value={value}
            placeholder="Type any value and hit <Enter>"
            onChange={handleTextInputChange}
            onKeyDown={handleKeyPress}
            style={{...style, minWidth: '240px'}}
            type="text"
          >
            <ChipGroup aria-label="Current selections">
              {values.map((item, index) => (
                <Chip
                  key={index}
                  onClick={() => handleItemRemove(item)}
                >
                  {value}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {(values.length > 0 || !!value) && (
              <Button
                variant="plain"
                onClick={() => {
                  setValues([]);
                  setValue('');
                }}
                aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </React.Fragment>
    );
}

MultiValueInput.propTypes = {
  onAddValue: PropTypes.func,
  onRemoveValue: PropTypes.func,
  onValuesChange: PropTypes.func,
  style: PropTypes.object
}

export default MultiValueInput;
