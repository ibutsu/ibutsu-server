import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import Linkify from 'react-linkify';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { linkifyDecorator } from './decorators';



export class EditWidgetModal extends React.Component {
  static propTypes = {
    onSave: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool,
    data: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      widgetType: null,
      title: props.data.title,
      params: props.data.params,
      weight: props.data.weight,
      isTitleValid: true,
      areParamsFilled: true,
      componentLoaded: false,
    };
  }


  onNameChange = (name) => {
    this.setState({name});
  }

  onExpiryDateChange = (expiryStr) => {
    this.setState({expiryDate: expiryStr});
  }

  onSave = () => {
    const updatedWidget = {
      title: this.state.title,
      params: this.state.params,
      weight: parseInt(this.state.weight),
      type: 'widget',
      widget: this.props.data.widget
    }
    this.props.onSave(updatedWidget);
    this.setState({
      widgetType: null,
      title: '',
      params: {},
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false
    });
  }

  onClose = () => {
    this.setState({
      title: '',
      params: {},
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false,
    });
    this.props.onClose();
  }

  onTitleChange = (value) => {
    this.setState({title: value, isTitleValid: (value !== '')});
  }

  onWeightChange = (value) => {
    this.setState({weight: value});
  }

  onParamChange = (value, event) => {
    const params = this.state.params;
    let areParamsFilled = true;
    if (event) {
      params[event.target.name] = value;
    }
    this.setState({params: params});
    this.state.widgetType.params.forEach(widgetParam => {
        if ((widgetParam.required) && (!params[widgetParam.name])) {
          areParamsFilled = false;
        }
    });
    this.setState({areParamsFilled: areParamsFilled});
  }

  componentDidMount() {
    HttpClient.get([Settings.serverUrl, 'widget', 'types'], {'type': 'widget'})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        data.types.forEach(type => {
          if (type.id == this.props.data.widget) {
            this.setState({widgetType: type});
            this.setState({componentLoaded: true});
          }
        });
      });
  }

  render () {
    const { widgetType, componentLoaded } = this.state;
    return (
      <Modal
        variant={ModalVariant.small}
        title="Edit widget"
        isOpen={this.props.isOpen}
        onClose={this.onClose}
        actions={[
          <Button key="save" variant="primary" onClick={this.onSave}>Save</Button>,
          <Button key="cancel" variant="link" onClick={this.onClose}>Cancel</Button>
        ]}
      >
        <Form>
          <FormGroup label="Title" fieldId="widget-title" helperText="A title for the widget" validated={this.isTitleValid} helperTextInvalid="Please enter a title for this widget" helperTextInvalidIcon={<ExclamationCircleIcon/>} isRequired>
            <TextInput type="text" id="widget-title" name="widget-title" value={this.state.title} onChange={this.onTitleChange} validated={this.state.isTitleValid} isRequired />
          </FormGroup>
          <FormGroup label="Weight" fieldId="widget-weight" helperText="How widgets are ordered on the dashboard">
            <TextInput type="number" id="widget-weight" name="widget-weight" value={this.state.weight} onChange={this.onWeightChange} />
          </FormGroup>
          {componentLoaded ? widgetType.params.map(param => {
            return (
              <React.Fragment key={param.name}>
                <FormGroup
                label={param.name}
                fieldId={param.name}
                helperText={<Linkify componentDecorator={linkifyDecorator}>{param.description}</Linkify>}
                isRequired={param.required}>
                  <TextInput
                    value={this.state.params[param.name]}
                    type={(param.type === 'integer' || param.type === 'float') ? 'number' : 'text'}
                    id={param.name}
                    aria-describedby={`${param.name}-helper`}
                    name={param.name}
                    onChange={this.onParamChange}
                    isRequired={param.required}
                  />
                </FormGroup>
              </React.Fragment>
            )
          }): ""}
        </Form>
      </Modal>
    );
  }
}
