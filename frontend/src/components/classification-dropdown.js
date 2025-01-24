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


function ClassificationDropdown (props) {
  const [testResult, setTestResult] = useState(props.testResult);
  const [classificationOpen, setclassificationOpen] = useState(false);

  function onClassificationSelect(_event, selection) {
    setTestResult({
      ...testResult,
      'metadata': {
        ...testResult.metadata,
        'classification': selection
      }
    })
    setclassificationOpen(!classificationOpen);
    HttpClient.put([Settings.serverUrl, 'result', testResult['id']], {}, testResult)
    .catch(error => console.log(error));
  }

  useEffect(()=>{
    setTestResult(props.testResult)
  }, [props])

  return (
    <Dropdown
      isOpen={classificationOpen}
      onSelect={onClassificationSelect}
      onOpenChange={() => setclassificationOpen(false)}
      toggle={toggleRef => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setclassificationOpen(!classificationOpen)}
          isExpanded={classificationOpen}
        >
          {CLASSIFICATION[testResult.metadata && testResult.metadata.classification] || '(unset)'}
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
  )
}

ClassificationDropdown.propTypes = {
  testResult: PropTypes.object,
}


function MultiClassificationDropdown (props) {
  const [classificationOpen, setclassificationOpen] = useState(false);
  const {selectedResults, refreshFunc} = props;

  function onClassificationSelect(event) {
    let classification = event.target.getAttribute('value');
    if (selectedResults.length === 0) {
      setclassificationOpen(!classificationOpen)
    }
    else {
      selectedResults.forEach(result => {
        result['metadata']['classification'] = classification;
        HttpClient.put([Settings.serverUrl, 'result', result['id']], {}, result)
          .then(refreshFunc());
      })
      setclassificationOpen(!classificationOpen)
    }
  }
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
  )
}

MultiClassificationDropdown.propTypes = {
  selectedResults: PropTypes.array,
  refreshFunc: PropTypes.func
}

export {ClassificationDropdown, MultiClassificationDropdown};
