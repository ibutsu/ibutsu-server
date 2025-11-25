import { useState, useCallback } from 'react';
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
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextInput,
  ValidatedOptions,
} from '@patternfly/react-core';
import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';

const AddTokenModal = ({ isOpen, onClose, ouiaId = 'add-token-modal' }) => {
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
      await HttpClient.post([Settings.serverUrl, 'user', 'token'], {
        name,
        expires: expiry.toISOString(),
      });
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
      id={ouiaId}
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={localOnClose}
      ouiaId={ouiaId}
    >
      <ModalHeader title="Add Token" />
      <ModalBody>
        <Form ouiaId="add-token-form">
          <FormGroup label="Name" fieldId="token-name" isRequired>
            <TextInput
              type="text"
              id="token-name"
              name="token-name"
              value={name}
              onChange={(_, change) => setName(change)}
              validated={
                isNameValid ? ValidatedOptions.default : ValidatedOptions.error
              }
              isRequired
              ouiaId="token-name-input"
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
          <FormGroup label="Expiry" fieldId="token-expiry-date" isRequired>
            <DatePicker
              appendTo={() => document.getElementById(ouiaId)}
              onChange={(_, change) => {
                setExpiryDate(change);
              }}
              value={expiryDate}
              inputProps={{
                id: 'token-expiry-date',
                validated: isExpiryValid
                  ? ValidatedOptions.default
                  : ValidatedOptions.error,
              }}
              popoverProps={{
                enableFlip: true,
                position: 'auto',
                hasAutoWidth: true,
                appendTo: () => document.getElementById(ouiaId),
              }}
              ouiaId="token-expiry-datepicker"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={isExpiryValid ? 'default' : 'error'}>
                  {isExpiryValid
                    ? 'Enter the expiry date for this token'
                    : 'A valid expiry date is required'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={onSave}
          ouiaId="add-token-save-button"
        >
          Save
        </Button>
        <Button
          variant="link"
          onClick={localOnClose}
          ouiaId="add-token-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

AddTokenModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  ouiaId: PropTypes.string,
};

export default AddTokenModal;
