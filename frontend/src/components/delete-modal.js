import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Modal,
  ModalVariant,
  Text
} from '@patternfly/react-core';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';

function DeleteModal (props){
  const {
    onDelete,
    onClose,
    toDeleteId,
    toDeletePath,
    title,
    isOpen,
    body,
  } = props;

  function localOnDelete () {
    HttpClient.delete([Settings.serverUrl, ...toDeletePath, toDeleteId])
      .then(response => HttpClient.handleResponse(response))
      .then(onDelete?.());
    onClose();
  }

  return (
    <Modal
      variant={ModalVariant.small}
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key="delete" variant="danger" onClick={localOnDelete}>Delete</Button>,
        <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>
      ]}
    >
      <Text>{body}</Text>
    </Modal>
  );

};

DeleteModal.propTypes = {
  toDeleteId: PropTypes.string,
  title: PropTypes.string,
  body: PropTypes.node,
  onDelete: PropTypes.func,
  onClose: PropTypes.func,
  isOpen: PropTypes.bool,
  toDeletePath: PropTypes.array
};

export default DeleteModal;
