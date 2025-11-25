import { useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Skeleton,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';
import {
  useWidgetFilters,
  WidgetFilterComponent,
} from '../hooks/use-widget-filters';
import WidgetParameterFields from '../widget-parameter-fields';

const EditWidgetModal = ({ onSave, onClose, isOpen, data }) => {
  // const { primaryObject } = useContext(IbutsuContext);
  const [widgetType, setWidgetType] = useState({});
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState(10);
  const [componentLoaded, setComponentLoaded] = useState(false);
  const [params, setParams] = useState({});
  const [isTitleValid, setIsTitleValid] = useState(false);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);
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
    widgetType,
    widgetId: data.widget,
    initialFilterString:
      data?.params?.additional_filters || data?.params?.filters,
    componentLoaded,
  });

  const onSaveModal = useCallback(() => {
    const updatedParams = { ...params };

    // Convert activeFilters to API filter string for widgets that support filters
    const filterString = getActiveFiltersAsAPIString();
    if (filterString && hasFilterParam) {
      updatedParams.additional_filters = filterString;
    }

    // Note: project_id is handled at the widget config level, not in params
    // The Dashboard component will add project_id when saving the widget

    const updatedWidget = {
      title,
      params: updatedParams,
      weight: parseInt(weight) || 0,
      type: 'widget',
      widget: data.widget,
    };
    onSave(updatedWidget);
    setTitle('');
    setParams({});
    setWeight(0);
    setIsTitleValid(false);
    setWidgetType({});
    resetFilterContext();
  }, [
    params,
    getActiveFiltersAsAPIString,
    hasFilterParam,
    title,
    weight,
    data.widget,
    onSave,
    resetFilterContext,
  ]);

  const onCloseModal = useCallback(() => {
    setTitle('');
    setParams({});
    setWeight(0);
    setIsTitleValid(false);
    setWidgetType({});
    resetFilterContext();
    onClose();
  }, [onClose, resetFilterContext]);

  useEffect(() => {
    setTitle(data.title);
    setWeight(data.weight || 0);
    setParams(data.params || {});
  }, [data]);

  useEffect(() => {
    setIsTitleValid(title !== '');
    setSaveButtonDisabled(title === '');
  }, [title]);

  const onParamChange = useCallback((value, event) => {
    setParams((prevParams) => ({
      ...prevParams,
      [event.target.name]: value,
    }));
  }, []);

  useEffect(() => {
    const fetchWidgetTypes = async () => {
      const response = await HttpClient.get(
        [Settings.serverUrl, 'widget', 'types'],
        { type: 'widget' },
      );
      const typesData = await HttpClient.handleResponse(response);
      typesData.types.forEach((type) => {
        if (type.id === data.widget) {
          setWidgetType(type);
          setComponentLoaded(true);
        }
      });
    };
    const debouncer = setTimeout(() => {
      fetchWidgetTypes();
    }, 100);
    return () => {
      clearTimeout(debouncer);
    };
  }, [data.widget]);

  // Wrapper for onParamChange to match WidgetParameterFields expected signature
  const handleParamChange = useCallback(
    (event, value) => {
      onParamChange(value, event);
    },
    [onParamChange],
  );

  const filterComponent = useMemo(() => {
    if (!hasFilterParam || !componentLoaded) return null;

    return (
      <WidgetFilterComponent
        isResultBasedWidget={isResultBasedWidget}
        runs={runs}
        CustomFilterProvider={CustomFilterProvider}
        widgetId={data.widget}
        resetCounter={resetCounter}
      />
    );
  }, [
    hasFilterParam,
    componentLoaded,
    isResultBasedWidget,
    data.widget,
    runs,
    CustomFilterProvider,
    resetCounter,
  ]);

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onCloseModal}
      ouiaId="edit-widget-modal"
    >
      <ModalHeader title="Edit widget" />
      <ModalBody>
        {componentLoaded ? (
          <Form ouiaId="edit-widget-form">
            <FormGroup label="Title" fieldId="widget-title" isRequired>
              <TextInput
                type="text"
                id="widget-title"
                name="widget-title"
                value={title}
                onChange={(_, value) => setTitle(value)}
                validated={isTitleValid.toString()}
                isRequired
                ouiaId="widget-title-input"
              />
              {isTitleValid !== true && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem
                      icon={<ExclamationCircleIcon />}
                      variant="error"
                    >
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
            <WidgetParameterFields
              widgetType={widgetType}
              params={params}
              onChange={handleParamChange}
              isLoaded={componentLoaded}
            />
            {filterComponent}
          </Form>
        ) : (
          <div>
            <Skeleton
              width="10%"
              height="15px"
              style={{ marginBottom: '5px' }}
            />
            <Skeleton width="100%" height="30px" />
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={onSaveModal}
          isDisabled={saveButtonDisabled}
          ouiaId="edit-widget-save-button"
        >
          Save
        </Button>
        <Button
          variant="link"
          onClick={onCloseModal}
          ouiaId="edit-widget-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

EditWidgetModal.propTypes = {
  onSave: PropTypes.func,
  onClose: PropTypes.func,
  isOpen: PropTypes.bool,
  data: PropTypes.object,
};

export default EditWidgetModal;
