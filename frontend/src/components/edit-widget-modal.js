import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
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

  constructor (props) {
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
  };

  onExpiryDateChange = (expiryStr) => {
    this.setState({expiryDate: expiryStr});
  };

  onSave = () => {
    const updatedWidget = {
      title: this.state.title,
      params: this.state.params,
      weight: parseInt(this.state.weight),
      type: 'widget',
      widget: this.props.data.widget
    };
    this.props.onSave(updatedWidget);
    this.setState({
      widgetType: null,
      title: '',
      params: {},
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false
    });
  };

  onClose = () => {
    this.setState({
      title: '',
      params: {},
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false,
    });
    this.props.onClose();
  };

  onTitleChange = (value) => {
    this.setState({title: value, isTitleValid: (value !== '')});
  };

  onWeightChange = (value) => {
    this.setState({weight: value});
  };

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
  };

  componentDidMount () {
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
          <FormGroup label="Title" fieldId="widget-title" validated={this.isTitleValid} isRequired>
            <TextInput type="text" id="widget-title" name="widget-title" value={this.state.title} onChange={(_event, value) => this.onTitleChange(value)} validated={this.state.isTitleValid} isRequired />
            {this.state.isTitleValid !== true && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                    Please enter a title for this widget
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <FormGroup label="Weight" fieldId="widget-weight">
            <TextInput type="number" id="widget-weight" name="widget-weight" value={this.state.weight} onChange={(_event, value) => this.onWeightChange(value)} />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="default">
                How widgets are ordered on the dashboard
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          {componentLoaded ? widgetType.params.map(param => (
            <React.Fragment key={param.name}>
              <FormGroup
                label={param.name}
                fieldId={param.name}
                isRequired={param.required}>
                <TextInput
                  value={this.state.params[param.name]}
                  type={(param.type === 'integer' || param.type === 'float') ? 'number' : 'text'}
                  id={param.name}
                  aria-describedby={`${param.name}-helper`}
                  name={param.name}
                  onChange={(event, value) => this.onParamChange(value, event)}
                  isRequired={param.required}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="default">
                      <Linkify componentDecorator={linkifyDecorator}>
                        {param.description}
                      </Linkify>
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </React.Fragment>
          )): ''}
        </Form>
      </Modal>
    );
  }
}
