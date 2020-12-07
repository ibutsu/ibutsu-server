import React from 'react';
import PropTypes from 'prop-types';

import {
  Checkbox,
  Form,
  FormGroup,
  Grid,
  GridItem,
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
  Wizard
} from '@patternfly/react-core';
import {
  Table,
  TableHeader,
  TableBody,
} from '@patternfly/react-table';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import Linkify from 'react-linkify';

import { linkifyDecorator } from './decorators';
import { Settings } from '../settings';

export class NewWidgetWizard extends React.Component {
  static propTypes = {
    dashboard: PropTypes.object,
    onSave: PropTypes.func,
    onClose: PropTypes.func,
    isOpen: PropTypes.bool
  };

  constructor(props) {
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
  }

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
  }

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
    this.state.selectedType.params.forEach(widgetParam => {
        console.log(widgetParam);
        if ((widgetParam.required) && (!params[widgetParam.name])) {
          areParamsFilled = false;
        }
    });
    this.setState({areParamsFilled: areParamsFilled});
  }

  onNext = ({id}) => {
    if (id === 3) {
      this.onParamChange('', null);
    }
    this.setState({
      stepIdReached: this.state.stepIdReached < id ? id : this.state.stepIdReached
    });
  }

  componentDidMount() {
    fetch(Settings.serverUrl + '/widget/types?type=widget')
      .then(response => response.json())
      .then(data => {
        this.setState({widgetTypes: data.types});
      });
  }

  render() {
    const { widgetTypes, selectedType, selectedTypeId, stepIdReached, isTitleValid, areParamsFilled } = this.state;
    const steps = [
      {
        id: 1,
        name: 'Select type',
        enableNext: selectedType,
        component: (
          <Form>
            <Title headingLevel="h1" size="xl">Select a widget type</Title>
            {widgetTypes.map(widgetType => {
              return (
                <div key={widgetType.id}>
                  <Radio id={widgetType.id} value={widgetType.id} label={widgetType.title} description={widgetType.description} isChecked={selectedTypeId === widgetType.id} onChange={this.onSelectType}/>
                </div>
              );
            })}
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
            <FormGroup label="Title" fieldId="widget-title" helperText="A title for the widget" validated={this.isTitleValid} helperTextInvalid="Please enter a title for this widget" helperTextInvalidIcon={<ExclamationCircleIcon/>} isRequired>
              <TextInput type="text" id="widget-title" name="widget-title" value={this.state.title} onChange={this.onTitleChange} validated={this.state.isTitleValid} isRequired />
            </FormGroup>
            <FormGroup label="Weight" fieldId="widget-weight" helperText="How widgets are ordered on the dashboard">
              <TextInput type="number" id="widget-weight" name="widget-weight" value={this.state.weight} onChange={this.onWeightChange} />
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
            {!!selectedType && selectedType.params.map(param => {
              return (
                <React.Fragment key={param.name}>
                {(param.type === 'string' || param.type === 'integer' || param.type === 'float') &&
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
                }
                {param.type === 'boolean' &&
                  <FormGroup
                    label={param.name}
                    fieldId={param.name}
                    isRequired={param.required}
                    hasNoPaddingTop>
                    <Checkbox
                      isChecked={this.state.params[param.name]}
                      onChange={this.onParamChange}
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
                      onChange={this.onParamChange}
                      resizeOrientation='vertical' />
                  </FormGroup>
                }
                </React.Fragment>
              );
            })}
          </Form>
        )
      },
      {
        id: 4,
        name: 'Review details',
        canJumpTo: stepIdReached >= 4,
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
                    cells={["Name", "Value"]}
                    variant="compact"
                    borders="compactBorderless"
                    rows={Object.entries(this.state.params).map(param => { return [param[0], param[1].toString()]; })}
                    aria-label="Parameters">
                    <TableHeader />
                    <TableBody />
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
        aria-describedby="add-widget-description"
        aria-labelledby="add-widget-title"
      >
        <Wizard
          titleId="add-widget-title"
          descriptionId="add-widget-description"
          title="Add Widget"
          description="Add a widget to the current dashboard"
          steps={steps}
          onNext={this.onNext}
          onSave={this.onSave}
          onClose={this.onClose}
          height={400}
        />
      </Modal>
    );
  }
}
