import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

const NewDashboardModal = ({
  project,
  saveCallback,
  closeCallback,
  isOpen,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isTitleValid, setIsTitleValid] = useState(false);

  const modalOnSave = useCallback(() => {
    if (title === '') {
      setIsTitleValid(false);
      return;
    }
    const newDashboard = {
      title,
      description,
      project_id: project?.id,
    };
    saveCallback(newDashboard);
    setTitle('');
    setDescription('');
    setIsTitleValid(false);
  }, [title, description, project?.id, saveCallback]);

  const modalOnClose = useCallback(() => {
    closeCallback();
    setTitle('');
    setDescription('');
    setIsTitleValid(false);
  }, [closeCallback]);

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={closeCallback}
    >
      <ModalHeader title="New Dashboard" />
      <ModalBody>
        <Form>
          <FormGroup
            label="Title"
            fieldId="dashboard-title"
            helpertextinvalid="A dashboard title is required"
            helpertextinvalidicon={<ExclamationCircleIcon />}
            isRequired
          >
            <TextInput
              type="text"
              id="dashboard-title"
              name="dashboard-title"
              value={title}
              onChange={(_, value) => setTitle(value)}
              validated={isTitleValid.toString()}
              isRequired
            />
          </FormGroup>
          <FormGroup label="Description" fieldId="dashboard-description">
            <TextInput
              type="text"
              id="dashboard-description"
              name="dashboard-description"
              value={description}
              onChange={(_, value) => setDescription(value)}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={modalOnSave}>
          Save
        </Button>
        <Button variant="link" onClick={modalOnClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

NewDashboardModal.propTypes = {
  project: PropTypes.object,
  saveCallback: PropTypes.func,
  closeCallback: PropTypes.func,
  isOpen: PropTypes.bool,
};

export default NewDashboardModal;
