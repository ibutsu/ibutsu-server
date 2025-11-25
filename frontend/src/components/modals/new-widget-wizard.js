import { useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

import {
  Content,
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
  TextInput,
  Title,
  Wizard,
  WizardHeader,
  WizardStep,
} from '@patternfly/react-core';

import { Tbody, Td, Th, Thead, Tr, Table } from '@patternfly/react-table';

import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';
import {
  useWidgetFilters,
  WidgetFilterComponent,
} from '../hooks/use-widget-filters';
import WidgetParameterFields from '../widget-parameter-fields';
import { filterNonFilterParams } from '../../utilities/widget';

const NewWidgetWizard = ({
  dashboard,
  saveCallback,
  closeCallback,
  isOpen,
  ouiaId = 'new-widget-wizard-modal',
}) => {
  // const { primaryObject } = useContext(IbutsuContext);
  const [widgetTypes, setWidgetTypes] = useState([]);
  const [title, setTitle] = useState('');
  const [params, setParams] = useState({});
  const [weight, setWeight] = useState(0);
  const [titleValid, setTitleValid] = useState(false);
  const [paramsFilled, setParamsFilled] = useState(false);
  const [selectedType, setSelectedType] = useState({});
  const [selectedTypeId, setSelectedTypeId] = useState();
  const [stepIdReached, setStepIdReached] = useState(1);
  // Use the custom widget filters hook
  const {
    isResultBasedWidget,
    hasFilterParam,
    getActiveFiltersAsAPIString,
    resetFilterContext,
    CustomFilterProvider,
    resetCounter,
    runs,
  } = useWidgetFilters({
    widgetType: selectedType,
    widgetId: selectedTypeId,
    initialFilterString: '',
    componentLoaded: !!selectedTypeId, // Only fetch runs when a widget type is selected
  });

  const clearState = useCallback(() => {
    setTitle('');
    setParams({});
    setWeight(0);
    setTitleValid(false);
    setParamsFilled(false);
    setSelectedType();
    setSelectedTypeId();
    setStepIdReached(1);
    resetFilterContext();
  }, [resetFilterContext]);

  const onSave = useCallback(() => {
    let newParams = {};
    Object.entries(params).forEach((paramPair) => {
      const param = selectedType.params?.find((el) => el.name === paramPair[0]);
      if (param) {
        let newValue = paramPair[1];
        if (param.type === 'float') {
          newValue = parseFloat(newValue);
        } else if (param.type === 'integer') {
          newValue = parseInt(newValue);
        } else if (param.type === 'list') {
          newValue = newValue.split('\n').map((val) => val.trim());
        }
        newParams[paramPair[0]] = newValue;
      }
    });

    // Convert activeFilters to API filter string for widgets that support filters
    const filterString = getActiveFiltersAsAPIString();
    if (filterString && hasFilterParam) {
      newParams.additional_filters = filterString;
    }

    // Note: project_id is handled at the widget config level, not in params
    // The Dashboard component will add project_id when saving the widget

    const newWidget = {
      title,
      params: newParams,
      weight: parseInt(weight),
      type: 'widget',
      widget: selectedTypeId,
      ...(dashboard && {
        dashboard_id: dashboard.id,
        project_id: dashboard.project_id,
      }),
    };
    saveCallback(newWidget);
    clearState();
  }, [
    params,
    selectedType,
    getActiveFiltersAsAPIString,
    hasFilterParam,
    title,
    weight,
    selectedTypeId,
    dashboard,
    saveCallback,
    clearState,
  ]);

  const onClose = useCallback(() => {
    clearState();
    closeCallback();
  }, [clearState, closeCallback]);

  const onSelectType = useCallback(
    (_, event) => {
      setSelectedTypeId(event.currentTarget.value);
      let target_type = null;
      let target_params = {};
      widgetTypes.forEach((widgetType) => {
        if (widgetType.id === event.currentTarget.value) {
          target_type = widgetType;
          widgetType.params.forEach((param) => {
            let paramDefault = '';
            if (param.default) {
              paramDefault = param.default;
            } else if (param.type === 'integer' || param.type === 'float') {
              paramDefault = 3;
            } else if (param.type === 'boolean') {
              paramDefault = false;
            }
            target_params[param.name] = paramDefault;
          });
        }
      });
      setSelectedType(target_type);
      setParams(target_params);
    },
    [widgetTypes],
  );

  const onTitleChange = useCallback((value) => {
    setTitle(value);
    setTitleValid(value !== '');
  }, []);

  const onParamChange = useCallback((event, value) => {
    if (event) {
      setParams((prevParams) => ({
        ...prevParams,
        [event.target.name]: value,
      }));
    }
  }, []);

  const onNext = useCallback((_, currentStep) => {
    setStepIdReached((prevStepId) => Math.max(prevStepId, currentStep.id));
  }, []);

  // Centralized validation function for required parameters
  // Checks if a parameter value is valid based on its type and required status
  const isParamValid = useCallback(
    (param) => {
      if (!param.required) {
        return true;
      }
      const paramValue = params[param.name];
      // Check if parameter is missing or invalid based on type
      if (paramValue === undefined || paramValue === null) {
        return false;
      }
      if (param.type === 'string' && paramValue === '') {
        return false;
      }
      // For numeric and boolean types, 0 and false are valid values
      return true;
    },
    [params],
  );

  useEffect(() => {
    // Filter out 'additional_filters' and 'project' params as they're handled separately
    const nonFilterParams = filterNonFilterParams(selectedType?.params || []);
    const areParamsFilled = nonFilterParams.every((param) =>
      isParamValid(param),
    );
    setParamsFilled(areParamsFilled);
  }, [params, selectedType, isParamValid]);

  useEffect(() => {
    const fetchWidgetTypes = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'types'],
          { type: 'widget' },
        );
        const data = await HttpClient.handleResponse(response);
        setWidgetTypes(data.types);
      } catch (error) {
        console.error(error);
      }
    };
    fetchWidgetTypes();
  }, []);

  // Validation state for form field rendering
  // Translates the validation result to PatternFly's validation state
  const handleRequiredParam = useCallback(
    (param) => {
      return isParamValid(param) ? 'default' : 'error';
    },
    [isParamValid],
  );

  const steps = useMemo(
    () => [
      {
        id: 1,
        name: 'Select type',
        enableNext: selectedTypeId,
        component: (
          <Form ouiaId="widget-type-selection-form">
            <Title headingLevel="h1" size="xl">
              Select a widget type
            </Title>
            {widgetTypes.map((widgetType) => (
              <div key={widgetType.id}>
                <Radio
                  id={widgetType.id}
                  value={widgetType.id}
                  label={widgetType.title}
                  description={widgetType.description}
                  isChecked={selectedTypeId === widgetType.id}
                  onChange={(event, _) => onSelectType(_, event)}
                  ouiaId={`widget-type-radio-${widgetType.id}`}
                />
              </div>
            ))}
          </Form>
        ),
      },
      {
        id: 2,
        name: 'Set info',
        canJumpTo: stepIdReached >= 2,
        enableNext: titleValid,
        component: (
          <Form isHorizontal ouiaId="widget-info-form">
            <Title headingLevel="h1" size="xl">
              Set widget information
            </Title>
            <FormGroup label="Title" fieldId="widget-title" isRequired>
              <TextInput
                type="text"
                id="widget-title"
                name="widget-title"
                value={title}
                onChange={(_, value) => onTitleChange(value)}
                validated={titleValid.toString()}
                isRequired
                ouiaId="widget-title-input"
              />
              {titleValid !== true && (
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
              <TextInput
                type="number"
                id="widget-weight"
                name="widget-weight"
                value={weight}
                onChange={(_, value) => setWeight(value)}
                ouiaId="widget-weight-input"
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="default">
                    How widgets are ordered on the dashboard
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </Form>
        ),
      },
      {
        id: 3,
        name: 'Set parameters',
        canJumpTo: stepIdReached >= 3,
        enableNext: paramsFilled,
        component: (
          <Form isHorizontal ouiaId="widget-parameters-form">
            <Title headingLevel="h1" size="xl">
              Set widget parameters
            </Title>
            <WidgetParameterFields
              widgetType={selectedType}
              params={params}
              onChange={onParamChange}
              handleRequiredParam={handleRequiredParam}
              isLoaded={!!selectedType}
            />
          </Form>
        ),
      },
      ...(hasFilterParam
        ? [
            {
              id: 4,
              name: 'Set filters',
              canJumpTo: stepIdReached >= 4,
              enableNext: true,
              component: (
                <Form isHorizontal ouiaId="widget-filters-form">
                  <Title headingLevel="h1" size="xl">
                    Configure filters
                  </Title>
                  <WidgetFilterComponent
                    isResultBasedWidget={isResultBasedWidget}
                    runs={runs}
                    CustomFilterProvider={CustomFilterProvider}
                    widgetId={selectedTypeId}
                    resetCounter={resetCounter}
                  />
                </Form>
              ),
            },
          ]
        : []),
      {
        id: hasFilterParam ? 5 : 4,
        name: 'Review details',
        canJumpTo: stepIdReached >= (hasFilterParam ? 5 : 4),
        enableNext: true,
        nextButtonText: 'Finish',
        component: (
          <Stack hasGutter>
            <StackItem>
              <Title headingLevel="h1" size="xl">
                Review details
              </Title>
            </StackItem>
            <StackItem>
              <Grid hasGutter>
                <GridItem span="2">
                  <Title headingLevel="h4">Title</Title>
                </GridItem>
                <GridItem span="10">
                  <Content>
                    <Content component="p">{title}</Content>
                  </Content>
                </GridItem>
                <GridItem span="2">
                  <Title headingLevel="h4">Weight</Title>
                </GridItem>
                <GridItem span="10">
                  <Content>
                    <Content component="p">{weight}</Content>
                  </Content>
                </GridItem>
                <GridItem span="2">
                  <Title headingLevel="h4">Parameters</Title>
                </GridItem>
                <GridItem span="10">
                  <Table
                    variant="compact"
                    borders={true}
                    aria-label="Parameters"
                    ouiaId="widget-params-review-table"
                  >
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(params).map((param) => (
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
        ),
      },
    ],
    [
      selectedTypeId,
      widgetTypes,
      stepIdReached,
      titleValid,
      title,
      weight,
      paramsFilled,
      selectedType,
      params,
      onSelectType,
      onTitleChange,
      handleRequiredParam,
      onParamChange,
      hasFilterParam,
      isResultBasedWidget,
      runs,
      CustomFilterProvider,
      resetCounter,
    ],
  );

  return (
    <Modal
      isOpen={isOpen}
      aria-label="Add widget modal"
      variant={ModalVariant.large}
      ouiaId={ouiaId}
    >
      <Wizard
        header={
          <WizardHeader
            onClose={onClose}
            title="Add Widget"
            description="Add a widget to the current dashboard"
          />
        }
        onStepChange={onNext}
        onSave={onSave}
        onClose={onClose}
        ouiaId="new-widget-wizard"
      >
        {steps.map((step) => (
          <WizardStep
            key={step.id}
            name={step.name}
            id={step.id}
            footer={{
              isNextDisabled: !step.enableNext,
              nextButtonText: step.nextButtonText || 'Next',
            }}
          >
            {step.component}
          </WizardStep>
        ))}
      </Wizard>
    </Modal>
  );
};

NewWidgetWizard.propTypes = {
  dashboard: PropTypes.object,
  saveCallback: PropTypes.func,
  closeCallback: PropTypes.func,
  isOpen: PropTypes.bool,
  ouiaId: PropTypes.string,
};

export default NewWidgetWizard;
