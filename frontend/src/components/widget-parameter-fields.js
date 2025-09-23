import { Fragment } from 'react';
import PropTypes from 'prop-types';
import {
  Checkbox,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import Linkify from 'react-linkify';
import { linkifyDecorator } from './decorators';
import { filterNonFilterParams } from '../utilities/widget';

/**
 * Reusable component for rendering widget parameter fields
 * Handles all parameter types except filters (which are handled separately)
 */
const WidgetParameterFields = ({
  widgetType,
  params,
  onChange,
  handleRequiredParam = null,
  isLoaded = true,
}) => {
  if (!isLoaded || !widgetType?.params) {
    return null;
  }

  const nonFilterParams = filterNonFilterParams(widgetType.params);

  return (
    <>
      {nonFilterParams.map((param) => (
        <Fragment key={param.name}>
          {/* String, Integer, Float parameters */}
          {(param.type === 'string' ||
            param.type === 'integer' ||
            param.type === 'float') && (
            <FormGroup
              label={param.name}
              fieldId={param.name}
              isRequired={param.required}
            >
              <TextInput
                value={params[param.name] || ''}
                type={
                  param.type === 'integer' || param.type === 'float'
                    ? 'number'
                    : 'text'
                }
                id={param.name}
                aria-describedby={`${param.name}-helper`}
                name={param.name}
                onChange={(event, value) =>
                  onChange({ target: { name: param.name } }, value)
                }
                isRequired={param.required}
                validated={
                  handleRequiredParam ? handleRequiredParam(param) : 'default'
                }
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
          )}

          {/* Boolean parameters */}
          {param.type === 'boolean' && (
            <FormGroup
              label={param.name}
              fieldId={param.name}
              isRequired={param.required}
              hasNoPaddingTop
            >
              <Checkbox
                isChecked={params[param.name] || false}
                onChange={(event, value) =>
                  onChange({ target: { name: param.name } }, value)
                }
                id={param.name}
                name={param.name}
                label={param.description}
              />
            </FormGroup>
          )}

          {/* List parameters */}
          {param.type === 'list' && (
            <FormGroup label={param.name} fieldId={param.name}>
              <TextArea
                id={param.name}
                name={param.name}
                isRequired={param.required}
                value={params[param.name] || ''}
                onChange={(event, value) =>
                  onChange({ target: { name: param.name } }, value)
                }
                resizeOrientation="vertical"
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="default">
                    {`${param.description}. Place items on separate lines.`}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}
        </Fragment>
      ))}
    </>
  );
};

WidgetParameterFields.propTypes = {
  widgetType: PropTypes.object,
  params: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  handleRequiredParam: PropTypes.func, // Optional validation function
  isLoaded: PropTypes.bool,
};

export default WidgetParameterFields;
