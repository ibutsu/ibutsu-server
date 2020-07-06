import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  CardHeader,
  Dropdown,
  DropdownDirection,
  DropdownToggle,
  DropdownItem,
  Text,
  Tooltip
} from '@patternfly/react-core';
import { PficonHistoryIcon } from '@patternfly/react-icons';


export class WidgetHeader extends React.Component {
  static propTypes = {
    getDataFunc: PropTypes.func,
    title: PropTypes.string,
    actions: PropTypes.array
  }

  render () {
    const { title, getDataFunc, actions } = this.props;
    return (
      <CardHeader data-id="widget-header">
        <Text component="h2" style={{ fontSize: 20 }}>{title}</Text>
        {actions}
        <Button variant="plain" onClick={getDataFunc} title="Refresh" aria-label="Refresh" isInline>
          <PficonHistoryIcon />
        </Button>
      </CardHeader>
    );
  }
}


export class ParamDropdown extends React.Component {
  // parameter dropdown for changing widget params in the FE
  static propTypes = {
    defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    direction: PropTypes.string,
    dropdownItems: PropTypes.array,
    handleSelect: PropTypes.func,
    showDescription: PropTypes.bool,
    tooltip: PropTypes.string
  }

  constructor(props) {
    super(props);
    this.onSelect = this.onSelect.bind(this);
    this.onToggle = this.onToggle.bind(this);
    this.direction = this.props.direction || DropdownDirection.up;
    this.state = {
      isOpen: false,
      value: props.defaultValue || "Group data by?",
      showDescription: props.showDescription || true
    };
  }

  onToggle = isOpen => {
    this.setState({isOpen});
  }

  onSelect = (event) => {
    this.setState({
      isOpen: !this.state.isOpen,
    });
    this.props.handleSelect(event.target.innerText);
    this.setState({
      value: event.target.innerText
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      this.setState({
        value: this.props.defaultValue
      });
    }
  }

  render() {
    const { isOpen } = this.state;
    const { showDescription } = this.state;
    let dropdownItems = [];
    this.props.dropdownItems.forEach( (item) => {
      dropdownItems.push(<DropdownItem onClick={this.onSelect} key={item}> {item} </DropdownItem>)
    });
    return (
      <div data-id='widget-param-dropdown'>
        {showDescription &&
        <Text component='h3'>{this.props.description || this.props.tooltip || ""}</Text>
        }
        <Tooltip content={this.props.tooltip}>
          <Dropdown
            direction={this.direction}
            isOpen={isOpen}
            dropdownItems={dropdownItems}
            toggle={
              <DropdownToggle id="toggle-dropdown" onToggle={this.onToggle}>
                {this.state.value}
              </DropdownToggle>
            }
          />
        </Tooltip>
      </div>
    );
  }
}
