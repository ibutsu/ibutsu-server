import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  DatePicker,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput,
  ValidatedOptions,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';


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

  onExpiryDateChange = (expiryStr) => {
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
            helperTextInvalid="A token name is required"
            helperTextInvalidIcon={<ExclamationCircleIcon />}
            validated={this.state.isNameValid ? ValidatedOptions.default : ValidatedOptions.error}
            isRequired
          >
            <TextInput
              type="text"
              id="token-name"
              name="token-name"
              value={this.state.name}
              onChange={this.onNameChange}
              validated={this.state.isNameValid ? ValidatedOptions.default : ValidatedOptions.error}
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="Expiry"
            fieldId="token-expiry-date"
            helperTextInvalid="A valid epiry date is required"
            helperTextInvalidIcon={<ExclamationCircleIcon />}
            validated={this.state.isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error}
            isRequired
          >
            <DatePicker
              onChange={this.onExpiryDateChange}
              value={this.state.expiryDate}
              inputProps={{
                id: "token-expiry-date",
                validated: this.state.isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error
              }}
            />
          </FormGroup>
        </Form>
      </Modal>
    );
  }
}
