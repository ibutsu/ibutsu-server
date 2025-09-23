import { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Label,
  LabelGroup,
  Badge,
  Button,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';

import { Settings } from '../pages/settings';
import { HttpClient } from '../../utilities/http';
import { toAPIFilter } from '../utilities';

import { IbutsuContext } from '../contexts/ibutsu-context';

// TODO Extend this to contain the filter handling functions, and better integrate filter state
// with FilterTable. See https://github.com/ibutsu/ibutsu-server/issues/230

// TODO use activeFilterHook
const MetaFilter = ({
  setFilter,
  activeFilters,
  hideFilters,
  onRemoveFilter,
  onApplyReport,
  runId,
  id,
}) => {
  const context = useContext(IbutsuContext);
  const { primaryObject } = context;

  const [fieldSelection, setFieldSelection] = useState([]);
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const [isValueOpen, setIsValueOpen] = useState(false);

  const [valueOptions, setValueOptions] = useState([]);
  const [fieldOptions, setFieldOptions] = useState([]);

  const onFieldSelect = (_, selection) => {
    // clear value state too, otherwise the old selection remains selected but is no longer visible
    setFieldSelection(selection);
    setIsFieldOpen(false);
    setValueOptions([]);
    setIsValueOpen(false);
  };

  const onValueSelect = (_, selection) => {
    // update state and call setFilter
    setFilter(id, fieldSelection, selection);
    onFieldClear();
  };

  const onFieldClear = () => {
    setFieldSelection([]);
    setIsFieldOpen(false);
    setIsValueOpen(false);
    setValueOptions([]);
  };

  useEffect(() => {
    // fetch the available values for the selected meta field
    if (fieldSelection.length !== 0) {
      let api_filter = toAPIFilter(activeFilters).join();

      let projectId = primaryObject ? primaryObject.id : '';

      // make runId optional
      let params = {
        group_field: fieldSelection,
        additional_filters: api_filter,
        project: projectId,
      };
      if (runId) {
        params['run_id'] = runId;
      } else {
        params['days'] = 30;
      }

      HttpClient.get(
        [Settings.serverUrl, 'widget', 'result-aggregator'],
        params,
      )
        .then((response) => HttpClient.handleResponse(response))
        .then((data) => {
          setValueOptions(data);
        });
    }
  }, [fieldSelection, activeFilters, primaryObject, runId]);

  useEffect(() => {
    // Fetch field options for the project
    HttpClient.get([
      Settings.serverUrl,
      'project',
      'filter-params',
      primaryObject.id,
    ])
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setFieldOptions(data);
      });
  }, [primaryObject.id]);

  let values_available = valueOptions.length > 0;
  const valuePlaceholder = !fieldSelection.length
    ? 'Select a field first' // default instead of an else block
    : values_available
      ? 'Select value(s)'
      : 'No values for selected field';

  return (
    <>
      <Flex>
        <FlexItem>
          <Select
            key="metafield_select"
            aria-label="metadata-field-filter"
            isOpen={isFieldOpen}
            selected={fieldSelection}
            onOpenChange={(isOpen) => setIsFieldOpen(isOpen)}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setIsFieldOpen(!isFieldOpen)}
                isExpanded={isFieldOpen}
              >
                Filter by...
              </MenuToggle>
            )}
            onSelect={onFieldSelect}
          >
            <SelectList>
              {fieldOptions.map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
          <Select
            key="metavalue_select"
            aria-label={valuePlaceholder}
            isOpen={isValueOpen}
            // selections prop empty because setFilter callback applies and adds the filter
            isDisabled={
              fieldSelection.length === 0 ||
              (fieldSelection.length > 0 && !values_available)
            }
            onOpenChange={(isOpen) => setIsValueOpen(isOpen)}
            onSelect={onValueSelect}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setIsValueOpen(!isValueOpen)}
                isExpanded={isValueOpen}
                isDisabled={
                  fieldSelection.length === 0 ||
                  (fieldSelection.length > 0 && !values_available)
                }
              >
                {valuePlaceholder}
              </MenuToggle>
            )}
          >
            <SelectList>
              {valueOptions.map((option, index) => (
                <SelectOption
                  key={index}
                  value={option._id}
                  description={option.count + ' results'}
                >
                  {option._id}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FlexItem>
      </Flex>
      {activeFilters && Object.keys(activeFilters).length > 0 && (
        <Flex style={{ marginTop: '1rem', fontWeight: 'normal' }}>
          <Flex>
            <FlexItem style={{ marginBottom: '0.5rem' }}>
              Active filters
            </FlexItem>
          </Flex>
          <Flex grow={{ default: 'grow' }}>
            {Object.keys(activeFilters).map((key) => (
              <FlexItem
                style={{ marginBottom: '0.5rem' }}
                spacer={{ default: 'spacerXs' }}
                key={key}
              >
                {!hideFilters.includes(key) && (
                  <LabelGroup categoryName={key}>
                    <Label
                      variant="outline"
                      onClose={() => onRemoveFilter(id, key)}
                    >
                      {typeof activeFilters[key] === 'object' && (
                        <>{activeFilters[key]['val']}</>
                      )}
                      {typeof activeFilters[key] !== 'object' &&
                        activeFilters[key]}
                      <Badge isRead={true}>{activeFilters[key]['op']}</Badge>
                    </Label>
                  </LabelGroup>
                )}
              </FlexItem>
            ))}
          </Flex>
          {onApplyReport && (
            <Flex>
              <FlexItem style={{ marginLeft: '0.75em' }}>
                <Button onClick={onApplyReport} variant="secondary">
                  Use Active Filters in Report
                </Button>
              </FlexItem>
            </Flex>
          )}
        </Flex>
      )}
    </>
  );
};

MetaFilter.propTypes = {
  runId: PropTypes.string,
  setFilter: PropTypes.func,
  onRemoveFilter: PropTypes.func,
  onApplyReport: PropTypes.func,
  hideFilters: PropTypes.array,
  activeFilters: PropTypes.object,
  id: PropTypes.number,
};

export default MetaFilter;
