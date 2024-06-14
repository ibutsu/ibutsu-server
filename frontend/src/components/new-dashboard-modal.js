import React from 'react';
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


export class NewDashboardModal extends React.Component {
  static propTypes = {
    project: PropTypes.object,
    onSave: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  constructor(props) {
    super(props);
    this.state = {
      widgetTypes: [],
      title: '',
      description: '',
      isTitleValid: false
    };
  }

  onTitleChange = (title) => {
    this.setState({title});
  }

  onDescriptionChange = (description) => {
    this.setState({description});
  }

  onSave = () => {
    if (this.state.title === '') {
      this.setState({isTitleValid: false});
      return;
    }
    let newDashboard = {
      title: this.state.title,
      description: this.state.description
    };
    if (this.props.project) {
      newDashboard.project_id = this.props.project.id;
    }
    this.props.onSave(newDashboard);
    this.setState({
      title: '',
      description: '',
      isTitleValid: false
    });
  }

  onClose = () => {
    this.setState({
      title: '',
      description: '',
      isTitleValid: false
    });
    this.props.onClose();
  }

  render () {
    return (
      <Modal
        variant={ModalVariant.small}
        title="New Dashboard"
        isOpen={this.props.isOpen}
        onClose={this.onClose}
        actions={[
          <Button key="save" variant="primary" onClick={this.onSave}>Save</Button>,
          <Button key="cancel" variant="link" onClick={this.onClose}>Cancel</Button>
        ]}
      >
        <Form>
          <FormGroup label="Title" fieldId="dashboard-title" helpertextinvalid="A dashboard title is required" helpertextinvalidicon={<ExclamationCircleIcon />} validated={this.state.isTitleValid.toString()} isRequired>
            <TextInput type="text" id="dashboard-title" name="dashboard-title" value={this.state.title} onChange={(_event, title) => this.onTitleChange(title)} validated={this.state.isTitleValid} isRequired />
          </FormGroup>
          <FormGroup label="Description" fieldId="dashboard-description">
            <TextInput type="text" id="dashboard-description" name="dashboard-description" value={this.state.description} onChange={(_event, description) => this.onDescriptionChange(description)} />
          </FormGroup>
        </Form>
      </Modal>
    );
  }
}
