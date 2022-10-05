import React from 'react';
import PropTypes from 'prop-types';
import {
  Chip,
  ChipGroup,
  TextInput
} from '@patternfly/react-core';


function clone(obj) {
  if (null === obj || "object" !== typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, attr)) {
      copy[attr] = obj[attr];
    }
  }
  return copy;
}

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

  handleTextInputChange = value => {
    this.setState({
      value: value
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

  handleKeyPress = e => {
    if (e.charCode === 13) {  // 13 is the charCode for the <Enter> key
      this.handleItemAdd(e.target.value);
    }
  };

  render() {
    let style = clone(this.style);
    style["width"] = "auto";
    return (
      <React.Fragment>
        <ChipGroup>
          {this.state.values.map(value => (
            <Chip key={value} onClick={() => this.handleItemRemove(value)}>
              {value}
            </Chip>
          ))}
        </ChipGroup>
        <TextInput
          type="text"
          onChange={this.handleTextInputChange}
          onKeyPress={this.handleKeyPress}
          value={this.state.value}
          aria-label="multi-text-input"
          placeholder="Type any value and hit <Enter>"
          style={style}  // necessary to get chips on same line
        />
      </React.Fragment>
    );
  }
}
