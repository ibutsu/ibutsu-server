import React, { useState, useCallback } from 'react';
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
import { HttpClient } from '../services/http';
import { Settings } from '../settings';

const AddTokenModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isNameValid, setIsNameValid] = useState(true);
  const [isExpiryValid, setIsExpiryValid] = useState(true);

  const onSave = useCallback(async () => {
    const expiry = new Date(expiryDate);
    const now = new Date();

    if (name === '') {
      setIsNameValid(false);
      return;
    } else {
      setIsNameValid(true);
    }

    if (expiryDate === '') {
      setIsExpiryValid(false);
      return;
    } else {
      expiry.setHours(23, 59, 59, 999);
      if (expiry.getTime() <= now.getTime()) {
        setIsExpiryValid(false);
        return;
      }
    }

    try {
      await HttpClient.post([Settings.serverUrl, 'user', 'token'], { name, expires: expiry.toISOString() });
    } catch (error) {
      console.error('Error posting token:', error);
    }

    onClose();
  }, [name, expiryDate, onClose]);

  const localOnClose = useCallback(() => {
    onClose();
    setName('');
    setExpiryDate('');
    setIsNameValid(true);
    setIsExpiryValid(true);
  }, [onClose]);

  return (
    <Modal
      id="add-token-modal"
      variant={ModalVariant.small}
      title="Add Token"
      isOpen={isOpen}
      onClose={localOnClose}
      actions={[
        <Button key="save" variant="primary" onClick={onSave}>Save</Button>,
        <Button key="cancel" variant="link" onClick={localOnClose}>Cancel</Button>
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
            value={name}
            onChange={(_, change) => setName(change)}
            validated={isNameValid ? ValidatedOptions.default : ValidatedOptions.error}
            isRequired
          />
          {isNameValid !== true && (
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
          validated={isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error}
          isRequired
        >
          <DatePicker
            appendTo={() => document.getElementById('add-token-modal')}
            onChange={(_, change) => {setExpiryDate(change);}}
            value={expiryDate}
            inputProps={{
              id: 'token-expiry-date',
              validated: isExpiryValid ? ValidatedOptions.default : ValidatedOptions.error
            }}
            popoverProps={{
              enableFlip: false,
              position: 'bottom'
            }}
          />
          {isExpiryValid !== true && (
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
};

AddTokenModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default AddTokenModal;
