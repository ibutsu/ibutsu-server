import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';

import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { CLASSIFICATION } from '../constants';

const ClassificationDropdown = ({ testResult: initialTestResult }) => {
  const [testResult, setTestResult] = useState(initialTestResult);
  const [classificationOpen, setClassificationOpen] = useState(false);

  const onClassificationSelect = useCallback(
    async (_, selection) => {
      const updatedResult = {
        ...testResult,
        metadata: {
          ...testResult.metadata,
          classification: selection,
        },
      };
      setTestResult(updatedResult);
      setClassificationOpen(!classificationOpen);
      try {
        await HttpClient.put(
          [Settings.serverUrl, 'result', testResult['id']],
          {},
          updatedResult,
        );
      } catch (error) {
        console.error(error);
      }
    },
    [testResult, classificationOpen],
  );

  useEffect(() => {
    setTestResult(initialTestResult);
  }, [initialTestResult]);

  return (
    <Dropdown
      key={testResult.id}
      isOpen={classificationOpen}
      onSelect={onClassificationSelect}
      onOpenChange={() => setClassificationOpen(false)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setClassificationOpen(!classificationOpen)}
          isExpanded={classificationOpen}
        >
          {CLASSIFICATION[testResult?.metadata?.classification] || '(unset)'}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {Object.keys(CLASSIFICATION).map((key) => (
          <DropdownItem key={key} value={key}>
            {CLASSIFICATION[key]}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

ClassificationDropdown.propTypes = {
  testResult: PropTypes.object,
};

const MultiClassificationDropdown = ({ selectedResults }) => {
  const [classificationOpen, setClassificationOpen] = useState(false);

  const onClassificationSelect = useCallback(
    async (_, selection) => {
      if (selectedResults.length === 0) {
        setClassificationOpen(false);
      } else {
        try {
          await Promise.all(
            selectedResults.map((result) => {
              result['metadata']['classification'] = selection;
              return HttpClient.put(
                [Settings.serverUrl, 'result', result['id']],
                {},
                result,
              );
            }),
          );
        } catch (error) {
          console.error('Error setting classification: ', error);
        }
        setClassificationOpen(false);
      }
    },
    [selectedResults],
  );

  return (
    <Dropdown
      isOpen={classificationOpen}
      onSelect={onClassificationSelect}
      onOpenChange={() => setClassificationOpen(false)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          isDisabled={selectedResults.length === 0}
          onClick={() => setClassificationOpen(!classificationOpen)}
          isExpanded={classificationOpen}
        >
          Classify Selected Failures
        </MenuToggle>
      )}
    >
      <DropdownList>
        {Object.keys(CLASSIFICATION).map((key) => (
          <DropdownItem key={key} value={key}>
            {CLASSIFICATION[key]}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

MultiClassificationDropdown.propTypes = {
  selectedResults: PropTypes.array,
};

export { ClassificationDropdown, MultiClassificationDropdown };
