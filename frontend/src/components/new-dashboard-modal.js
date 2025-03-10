import React, { useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

const NewDashboardModal = (props) => {
  const {
    project,
    saveCallback,
    closeCallback,
    isOpen
  } = props;

  const [title, setTitle] = useState('');
  const [description, setDescription ] = useState('');
  const [isTitleValid, setIsTitleValid ] = useState(false);

  const modalOnSave = () => {
    console.dir(project);
    if (title === '') {
      setIsTitleValid(false);
      return;
    }
    let newDashboard = {
      title: title,
      description: description,
      project_id: project?.id
    };
    saveCallback(newDashboard);
    setTitle();
    setDescription();
    setIsTitleValid(false);
  };

  const modalOnClose = () => {
    closeCallback();
    setTitle();
    setDescription();
    setIsTitleValid(false);
  };

  return(
    <Modal
      variant={ModalVariant.small}
      title="New Dashboard"
      isOpen={isOpen}
      onClose={closeCallback}
      actions={[
        <Button key="save" variant="primary" onClick={modalOnSave}>Save</Button>,
        <Button key="cancel" variant="link" onClick={modalOnClose}>Cancel</Button>
      ]}
    >
      <Form>
        <FormGroup
          label="Title"
          fieldId="dashboard-title"
          helpertextinvalid="A dashboard title is required"
          helpertextinvalidicon={<ExclamationCircleIcon />}
          validated={isTitleValid.toString()}
          isRequired>
          <TextInput
            type="text"
            id="dashboard-title"
            name="dashboard-title"
            value={title}
            onChange={(_event, value) => setTitle(value)}
            validated={isTitleValid}
            isRequired />
        </FormGroup>
        <FormGroup label="Description" fieldId="dashboard-description">
          <TextInput
            type="text"
            id="dashboard-description"
            name="dashboard-description"
            value={description}
            onChange={(_event, value) => setDescription(value)} />
        </FormGroup>
      </Form>
    </Modal>
  );
};

NewDashboardModal.propTypes = {
  project: PropTypes.object,
  saveCallback: PropTypes.func,
  closeCallback: PropTypes.func,
  isOpen: PropTypes.bool
};

export default NewDashboardModal;
