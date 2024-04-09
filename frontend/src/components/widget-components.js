import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  CardHeader,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Text,
  Tooltip
} from '@patternfly/react-core';
import { PficonHistoryIcon, TimesIcon, PencilAltIcon } from '@patternfly/react-icons';


export class WidgetHeader extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    getDataFunc: PropTypes.func,
    onDeleteClick: PropTypes.func,
    title: PropTypes.string,
    actions: PropTypes.object,
    onEditClick: PropTypes.func
  }


  render () {
    const { title, getDataFunc, actions, onDeleteClick, onEditClick } = this.props;
    const headerActions = (
      <>
        {actions}
        {getDataFunc &&
        <Button variant="plain" onClick={getDataFunc} title="Refresh" aria-label="Refresh" isInline>
          <PficonHistoryIcon />
        </Button>
        }
        {onEditClick &&
        <Button variant="plain" onClick={onEditClick} title="Edit" aria-label="Edit" isInline>
          <PencilAltIcon />
        </Button>
        }
        {onDeleteClick &&
        <Button variant="plain" onClick={onDeleteClick} title="Remove from dashboard" aria-label="Delete" isInline>
          <TimesIcon />
        </Button>
        }
      </>
    );

    return (
      <CardHeader data-id="widget-header" actions={{ actions: headerActions }}>
        <Text component="h2" style={{ fontSize: 20 }}>{title}</Text>
      </CardHeader>
    );
  }
}


export class ParamDropdown extends React.Component {
  // parameter dropdown for changing widget params in the FE
  static propTypes = {
    defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    dropdownItems: PropTypes.array,
    handleSelect: PropTypes.func,
    showDescription: PropTypes.bool,
    tooltip: PropTypes.string
  }

  constructor(props) {
    super(props);
    this.onSelect = this.onSelect.bind(this);
    this.onToggle = this.onToggle.bind(this);
    this.state = {
      isOpen: false,
      value: props.defaultValue || "Group data by?",
      showDescription: props.showDescription || true
    };
  }

  onToggle = () => {
    this.setState({isOpen: !this.state.isOpen});
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

    return (
      <div data-id='widget-param-dropdown'>
        {showDescription &&
        <Text component='h3'>{this.props.description || this.props.tooltip || ""}</Text>
        }
        <Tooltip content={this.props.tooltip}>
          <Dropdown
            isOpen={isOpen}
            onSelect={this.onSelect}
            onOpenChange={() => this.setState({isOpen: false})}
            toggle={toggleRef => (
              <MenuToggle
                id="toggle-dropdown"
                ref={toggleRef}
                onClick={this.onToggle}
                isExpanded={isOpen}
              >
                {this.state.value}
              </MenuToggle>
            )}
            ouiaId="BasicDropdown"
            shouldFocusToggleOnSelect
          >
            <DropdownList>
              {this.props.dropdownItems.map((item) => (
                <DropdownItem onClick={this.onSelect} key={item}>
                  {item}
                </DropdownItem>
              ))}
            </DropdownList>
          </Dropdown>
        </Tooltip>
      </div>
    );
  }
}
