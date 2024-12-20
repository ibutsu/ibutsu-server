import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  DatePicker,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalVariant,
  TextInput,
  ValidatedOptions,
} from '@patternfly/react-core';

export class AddTokenModal extends React.Component {
  static propTypes = {
    onSave: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      expiryDate: '',
      isNameValid: true,
      isExpiryValid: true
    };
  }

  onNameChange = (name) => {
    this.setState({name});
  }

  onExpiryDateChange = (_event, expiryStr) => {
    this.setState({expiryDate: expiryStr});
  }

  onSave = () => {
    if (this.state.name === '' || this.state.expiryDate === '') {
      this.setState({
        isNameValid: this.state.name !== '',
        isExpiryValid: this.state.expiryDate !== ''
      });
      return;
    }
    const expiry = new Date(this.state.expiryDate);
    expiry.setHours(23, 59, 59, 999);
    const now = new Date();
    if (expiry.getTime() <= now.getTime()) {
      this.setState({isExpiryValid: false});
      return;
    }
    this.props.onSave({name: this.state.name, expiry: expiry});
    this.setState({
      name: '',
      expiryDate: '',
      isNameValid: true,
      isExpiryValid: true
    });
  }

  onClose = () => {
    this.setState({
      name: '',
      expiryDate: '',
      isNameValid: true,
      isExpiryValid: true
    });
    this.props.onClose();
  }

  render () {
    return (
      <Modal
        id="add-token-modal"
        variant={ModalVariant.small}
        title="Add Token"
        isOpen={this.props.isOpen}
        onClose={this.onClose}
        actions={[
          <Button key="save" variant="primary" onClick={this.onSave}>Save</Button>,
          <Button key="cancel" variant="link" onClick={this.onClose}>Cancel</Button>
        ]}
      >
        <Form>
          <FormGroup
            label="Name"
            fieldId="token-name"
            isRequired
          >
            <TextInput
              type="text"
              id="token-name"
              name="token-name"
              value={this.state.name}
              onChange={(_event, name) => this.onNameChange(name)}
              validated={this.state.isNameValid ? ValidatedOptions.default : ValidatedOptions.error}
              isRequired
            />
            {this.state.isNameValid !== true && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    A token name is required
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
              )}
          </FormGroup>
          <FormGroup
            label="Expiry"
            fieldId="token-expiry-date"
            validated={this.state.isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error}
            isRequired
          >
            <DatePicker
              appendTo={() => document.getElementById('add-token-modal')}
              onChange={this.onExpiryDateChange}
              value={this.state.expiryDate}
              inputProps={{
                id: 'token-expiry-date',
                validated: this.state.isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error
              }}
              popoverProps={{
                enableFlip: false,
                position: 'bottom'
              }}
            />
            {this.state.isExpiryValid !== true && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    A valid epiry date is required
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </Form>
      </Modal>
    );
  }
}
