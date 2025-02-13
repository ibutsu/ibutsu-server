import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Modal,
  ModalVariant,
  Text
} from '@patternfly/react-core';


export class DeleteModal extends React.Component {
  static propTypes = {
    id: PropTypes.object,
    title: PropTypes.string,
    body: PropTypes.node,
    onDelete: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  onDelete = () => {
    this.props.onDelete(this.props.id);
  };

  onClose = () => {
    this.props.onClose();
  };

  render () {
    return (
      <Modal
        variant={ModalVariant.small}
        title={this.props.title}
        isOpen={this.props.isOpen}
        onClose={this.onClose}
        actions={[
          <Button key="delete" variant="danger" onClick={this.onDelete}>Delete</Button>,
          <Button key="cancel" variant="link" onClick={this.onClose}>Cancel</Button>
        ]}
      >
        <Text>{this.props.body}</Text>
      </Modal>
    );
  }
}
