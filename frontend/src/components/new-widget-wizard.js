import React from 'react';
import PropTypes from 'prop-types';

import {
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Modal,
  ModalVariant,
  Radio,
  Stack,
  StackItem,
  Text,
  TextArea,
  TextContent,
  TextInput,
  Title,
  Wizard,
  WizardHeader,
  WizardStep,
} from '@patternfly/react-core';

import {
  Tbody,
  Table,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table';
import Linkify from 'react-linkify';
import { linkifyDecorator } from './decorators';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';

export class NewWidgetWizard extends React.Component {
  static propTypes = {
    dashboard: PropTypes.object,
    onSave: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  constructor (props) {
    super(props);
    this.state = {
      widgetTypes: [],
      title: '',
      params: {},
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false,
      selectedType: null,
      selectedTypeId: null,
      stepIdReached: 1
    };
  }

  onSave = () => {
    const { params } = this.state;
    let newParams = {};
    Object.entries(params).forEach(paramPair => {
      const param = this.state.selectedType.params.find(el => el.name === paramPair[0]);
      if (param) {
        // Some values need to be typecast/parsed
        let newValue = paramPair[1];
        if (param.type === 'float') {
          newValue = parseFloat(newValue);
        }
        else if (param.type === 'integer') {
          newValue = parseInt(newValue);
        }
        else if (param.type === 'list') {
          newValue = newValue.split('\n').map(val => val.trim());
        }
        newParams[paramPair[0]] = newValue;
      }
    });
    const newWidget = {
      title: this.state.title,
      params: newParams,
      weight: parseInt(this.state.weight),
      type: 'widget',
      widget: this.state.selectedTypeId
    };
    if (this.props.dashboard) {
      newWidget.dashboard_id = this.props.dashboard.id;
      newWidget.project_id = this.props.dashboard.project_id;
    }
    this.props.onSave(newWidget);
    this.setState({
      title: '',
      params: [],
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false,
      selectedType: null,
      selectedTypeId: null,
      stepIdReached: 1
    });
  };

  onClose = () => {
    this.setState({
      title: '',
      params: [],
      weight: 0,
      isTitleValid: false,
      areParamsFilled: false,
      selectedType: null,
      selectedTypeId: null,
      stepIdReached: 1
    });
    this.props.onClose();
  };

  onSelectType = (_, event) => {
    let selectedTypeId = event.currentTarget.value;
    let selectedType = null;
    let params = {};
    this.state.widgetTypes.forEach(widgetType => {
      if (widgetType.id === selectedTypeId) {
        selectedType = widgetType;
        widgetType.params.forEach(param => {
          let paramDefault = '';
          if (param.default) {
            // if the widget has a default defined, use that
            paramDefault = param.default;
          }
          else if (param.type === 'integer' || param.type === 'float') {
            // NOTE: This is a somewhat arbitrary value, numeric parameters should have sensible
            //       defaults provided in constants.py
            paramDefault = 3;
          }
          else if (param.type === 'boolean') {
            paramDefault = false;
          }
          params[param.name] = paramDefault;
        });
      }
    });
    this.setState({selectedTypeId: selectedTypeId, selectedType: selectedType, params: params});
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
    this.state.selectedType.params.forEach(widgetParam => {
      if ((widgetParam.required) && (!params[widgetParam.name])) {
        areParamsFilled = false;
      }
    });
    this.setState({areParamsFilled: areParamsFilled});
  };

  handleRequiredParam = (param) => {
    if (param.required) {
      if (this.state.params[param.name] === '') {
        return 'error';
      }
    }
    // TODO: Handle parameter types
    return 'default';
  };

  onNext = (_event, currentStep) => {
    if (currentStep.id === 3) {
      this.onParamChange('', null);
    }
    this.setState({
      stepIdReached: this.state.stepIdReached < currentStep.id ? currentStep.id : this.state.stepIdReached
    });
  };

  componentDidMount () {
    HttpClient.get([Settings.serverUrl, 'widget', 'types'], {'type': 'widget'})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({widgetTypes: data.types});
      });
  }

  render () {
    const { widgetTypes, selectedType, selectedTypeId, stepIdReached, isTitleValid, areParamsFilled } = this.state;
    const steps = [
      {
        id: 1,
        name: 'Select type',
        enableNext: selectedType,
        component: (
          <Form>
            <Title headingLevel="h1" size="xl">Select a widget type</Title>
            {widgetTypes.map(widgetType => (
              <div key={widgetType.id}>
                <Radio id={widgetType.id} value={widgetType.id} label={widgetType.title} description={widgetType.description} isChecked={selectedTypeId === widgetType.id} onChange={(event, _) => this.onSelectType(_, event)}/>
              </div>
            ))}
          </Form>
        )
      },
      {
        id: 2,
        name: 'Set info',
        canJumpTo: stepIdReached >= 2,
        enableNext: isTitleValid,
        component: (
          <Form isHorizontal>
            <Title headingLevel="h1" size="xl">Set widget information</Title>
            <FormGroup label="Title" fieldId="widget-title" isRequired>
              <TextInput type="text" id="widget-title" name="widget-title" value={this.state.title} onChange={(_event, value) => this.onTitleChange(value)} validated={this.state.isTitleValid ? 'default' : 'error'} isRequired />
              {this.state.isTitleValid !== true && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">
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
          </Form>
        )
      },
      {
        id: 3,
        name: 'Set parameters',
        canJumpTo: stepIdReached >= 3,
        enableNext: areParamsFilled,
        component: (
          <Form isHorizontal>
            <Title headingLevel="h1" size="xl">Set widget parameters</Title>
            {!!selectedType && selectedType.params.map(param => (
              <React.Fragment key={param.name}>
                {(param.type === 'string' || param.type === 'integer' || param.type === 'float') &&
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
                      validated={this.handleRequiredParam(param)}
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
                }
                {param.type === 'boolean' &&
                  <FormGroup
                    label={param.name}
                    fieldId={param.name}
                    isRequired={param.required}
                    hasNoPaddingTop>
                    <Checkbox
                      isChecked={this.state.params[param.name]}
                      onChange={(event, value) => this.onParamChange(value, event)}
                      id={param.name}
                      name={param.name}
                      label={param.description} />
                  </FormGroup>
                }
                {param.type === 'list' &&
                  <FormGroup
                    label={param.name}
                    fieldId={param.name}
                    helperText={`${param.description}. Place items on separate lines.`}>
                    isRequired={param.required}
                    <TextArea
                      id={param.name}
                      name={param.name}
                      isRequired={param.required}
                      value={this.state.params[param.name]}
                      onChange={(event, value) => this.onParamChange(value, event)}
                      resizeOrientation='vertical' />
                  </FormGroup>
                }
              </React.Fragment>
            ))}
          </Form>
        )
      },
      {
        id: 4,
        name: 'Review details',
        canJumpTo: stepIdReached >= 4,
        enableNext: true,
        nextButtonText: 'Finish',
        component: (
          <Stack hasGutter>
            <StackItem>
              <Title headingLevel="h1" size="xl">Review details</Title>
            </StackItem>
            <StackItem>
              <Grid hasGutter>
                <GridItem span="2">
                  <Title headingLevel="h4">Title</Title>
                </GridItem>
                <GridItem span="10">
                  <TextContent><Text>{this.state.title}</Text></TextContent>
                </GridItem>
                <GridItem span="2">
                  <Title headingLevel="h4">Weight</Title>
                </GridItem>
                <GridItem span="10">
                  <TextContent><Text>{this.state.weight}</Text></TextContent>
                </GridItem>
                <GridItem span="2">
                  <Title headingLevel="h4">Parameters</Title>
                </GridItem>
                <GridItem span="10">
                  <Table
                    variant="compact"
                    borders={true}
                    aria-label="Parameters">
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(this.state.params).map(param => (
                        <Tr key={param[0]}>
                          <Td>{param[0]}</Td>
                          <Td>{param[1].toString()}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </GridItem>
              </Grid>
            </StackItem>
          </Stack>
        )
      }
    ];
    return (
      <Modal
        isOpen={this.props.isOpen}
        variant={ModalVariant.large}
        showClose={false}
        onClose={this.onClose}
        hasNoBodyWrapper
        aria-label='Add widget modal'
      >
        <Wizard
          height={400}
          header={
            <WizardHeader
              onClose={this.onClose}
              title="Add Widget"
              description="Add a widget to the current dashboard"
            />
          }
          onStepChange={this.onNext}
          onSave={this.onSave}
          onClose={this.onClose}
        >
          {steps.map(step => (
            <WizardStep
              key={step.id}
              name={step.name}
              id={step.id}
              footer={{ isNextDisabled: !step.enableNext, nextButtonText: step.nextButtonText? step.nextButtonText : 'Next' }}
            >
              {step.component}
            </WizardStep>
          ))}
        </Wizard>
      </Modal>
    );
  }
}
