import React from 'react';
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


export class MultiValueInput extends React.Component {
  static propTypes = {
    onAddValue: PropTypes.func,
    onRemoveValue: PropTypes.func,
    onValuesChange: PropTypes.func,
    style: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.style = props.style || {};
    this.state = {
      values: [],
      value: ''
    };
  }

  handleTextInputChange = (_event, value) => {
    this.setState({
      value: value
    });
  };

  handleItemRemove = value => {
    const currentValues = this.state.values;
    const newValues = currentValues.filter(v => v !== value);
    this.setState({values: newValues}, () => {
      if (this.props.onRemoveValue) {
        this.props.onRemoveValue(value);
      }
      if (this.props.onValuesChange){
        this.props.onValuesChange(newValues);
      }
    });
  };

  handleItemAdd = value => {
    if (!this.state.values.includes(value)) {
      const newValues = this.state.values.concat(value);
      this.setState({values: newValues}, () => {
        if (this.props.onAddValue) {
          this.props.onAddValue(value);
        }
        if (this.props.onValuesChange) {
          this.props.onValuesChange(newValues);
        }
     });
    }
    this.setState({
      value: ''
    });
  };

  handleEnter = () => {
    if (this.state.value.length) {
      this.handleItemAdd(this.state.value);
    }
  };

  handleKeyPress = event => {
    switch (event.key) {
      case 'Enter':
        this.handleEnter();
        break;
    }
  };

  render() {
    return (
      <React.Fragment>
        <TextInputGroup>
          <TextInputGroupMain
            value={this.state.value}
            placeholder="Type any value and hit <Enter>"
            onChange={this.handleTextInputChange}
            onKeyDown={this.handleKeyPress}
            style={{minWidth: "240px"}}
            type={"text"}
          >
            <ChipGroup aria-label="Current selections">
              {this.state.values.map((value, index) => (
                <Chip
                  key={index}
                  onClick={() => this.handleItemRemove(value)}
                >
                  {value}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {(this.state.values.length > 0 || !!this.state.value) && (
              <Button variant="plain" onClick={() => {
                this.setState({
                  values: [],
                  value: ''
                });
              }} aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </React.Fragment>
    );
  }
}
