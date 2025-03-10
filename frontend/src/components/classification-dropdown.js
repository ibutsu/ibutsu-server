import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { CLASSIFICATION } from '../constants.js';

const ClassificationDropdown = (props) => {
  const [testResult, setTestResult] = useState(props.testResult);
  const [classificationOpen, setclassificationOpen] = useState(false);

  const onClassificationSelect = (_event, selection) => {
    let updatedResult = {
      ...testResult,
      'metadata': {
        ...testResult.metadata,
        'classification': selection
      }
    };
    setTestResult(updatedResult);
    setclassificationOpen(!classificationOpen);
    HttpClient.put([Settings.serverUrl, 'result', testResult['id']], {}, updatedResult)
      .then(console.log('put classification'))
      .catch(error => console.error(error));
  };

  useEffect(()=>{
    setTestResult(props.testResult);
  }, [props.testResult]);

  return (
    <Dropdown
      key={testResult.id}
      isOpen={classificationOpen}
      onSelect={onClassificationSelect}
      onOpenChange={() => setclassificationOpen(false)}
      toggle={toggleRef => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setclassificationOpen(!classificationOpen)}
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


const MultiClassificationDropdown = (props) => {
  // TODO: callback to trigger re-render of the classify failures page
  const {
    selectedResults,
  } = props;

  const [classificationOpen, setclassificationOpen] = useState(false);

  const onClassificationSelect = (_event, selection) => {
    if (selectedResults.length === 0) {
      setclassificationOpen(false);
    }
    else {
      selectedResults.forEach(result => {
        result['metadata']['classification'] = selection;
        HttpClient.put([Settings.serverUrl, 'result', result['id']], {}, result)
          .catch(error => console.error('Error setting classification: ' + error));
      });
      setclassificationOpen(false);
    }
  };
  return (
    <Dropdown
      isOpen={classificationOpen}
      onSelect={onClassificationSelect}
      onOpenChange={() => setclassificationOpen(false)}
      toggle={toggleRef => (
        <MenuToggle
          ref={toggleRef}
          isDisabled={selectedResults.length === 0}
          onClick={() => setclassificationOpen(!classificationOpen)}
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

export {ClassificationDropdown, MultiClassificationDropdown};
