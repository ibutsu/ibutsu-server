import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import Linkify from 'react-linkify';

import { HttpClient } from '../../utilities/http';
import { Settings } from '../../pages/settings';
import { linkifyDecorator } from '../decorators';

const EditWidgetModal = ({ onSave, onClose, isOpen, data }) => {
  const [widgetType, setWidgetType] = useState({});
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState(10);
  const [componentLoaded, setComponentLoaded] = useState(false);
  const [params, setParams] = useState({});
  const [isTitleValid, setIsTitleValid] = useState(false);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const onSaveModal = useCallback(() => {
    const updatedWidget = {
      title,
      params,
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
  }, [title, params, weight, data.widget, onSave]);

  const onCloseModal = useCallback(() => {
    setTitle('');
    setParams({});
    setWeight(0);
    setIsTitleValid(false);
    setWidgetType({});
    onClose();
  }, [onClose]);

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

  const widgetParams = useMemo(
    () =>
      componentLoaded
        ? widgetType?.params.map((param) => (
            <React.Fragment key={param.name}>
              <FormGroup
                label={param.name}
                fieldId={param.name}
                isRequired={param.required}
              >
                <TextInput
                  value={params[param.name]}
                  type={
                    param.type === 'integer' || param.type === 'float'
                      ? 'number'
                      : 'text'
                  }
                  id={param.name}
                  aria-describedby={`${param.name}-helper`}
                  name={param.name}
                  onChange={(event, value) => onParamChange(value, event)}
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
          ))
        : '',
    [componentLoaded, widgetType, params, onParamChange],
  );

  return (
    <Modal variant={ModalVariant.medium} isOpen={isOpen} onClose={onCloseModal}>
      <ModalHeader title="Edit widget" />
      <ModalBody>
        {componentLoaded ? (
          <Form>
            <FormGroup label="Title" fieldId="widget-title" isRequired>
              <TextInput
                type="text"
                id="widget-title"
                name="widget-title"
                value={title}
                onChange={(_, value) => setTitle(value)}
                validated={isTitleValid.toString()}
                isRequired
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
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="default">
                    How widgets are ordered on the dashboard
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            {widgetParams}
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
        >
          Save
        </Button>
        <Button variant="link" onClick={onCloseModal}>
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
