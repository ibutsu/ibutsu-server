import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Modal,
  ModalVariant,
  Text
} from '@patternfly/react-core';


export class DeleteDashboardModal extends React.Component {
  static propTypes = {
    dashboard: PropTypes.object,
    onDelete: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  onDelete = () => {
    this.props.onDelete(this.props.dashboard);
  }

  onClose = () => {
    this.props.onClose();
  }

  render () {
    return (
      <Modal
        variant={ModalVariant.small}
        title="Delete dashboard"
        isOpen={this.props.isOpen}
        onClose={this.onClose}
        actions={[
          <Button key="delete" variant="danger" onClick={this.onDelete}>Delete</Button>,
          <Button key="cancel" variant="link" onClick={this.onClose}>Cancel</Button>
        ]}
      >
      <Text>Would you like to delete the current dashboard? <strong>ALL WIDGETS</strong> on the dashboard will also be <strong>deleted</strong>.</Text>
      </Modal>
    );
  }
}
