import PropTypes from 'prop-types';

import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';

const DeleteModal = ({
  onDelete,
  onClose,
  toDeleteId,
  toDeletePath,
  title,
  isOpen,
  body,
  ouiaId = 'delete-confirmation-modal',
}) => {
  const localOnDelete = async () => {
    try {
      const response = await HttpClient.delete([
        Settings.serverUrl,
        ...toDeletePath,
        toDeleteId,
      ]);
      await HttpClient.handleResponse(response);
      onDelete?.();
    } catch (error) {
      console.error(error);
    }
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      ouiaId={ouiaId}
    >
      <ModalHeader title={title} />
      <ModalBody>
        <Content component="div">{body}</Content>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="danger"
          onClick={localOnDelete}
          ouiaId="delete-confirm-button"
        >
          Delete
        </Button>
        <Button variant="link" onClick={onClose} ouiaId="delete-cancel-button">
          Cancel
        </Button>
      </ModalFooter>
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
  toDeletePath: PropTypes.array,
  ouiaId: PropTypes.string,
};

export default DeleteModal;
