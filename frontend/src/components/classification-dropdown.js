import React from 'react';
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


export class ClassificationDropdown extends React.Component {
  static propTypes = {
    testResult: PropTypes.object,
  };

  constructor (props) {
    super(props);
    this.state = {
      testResult: this.props.testResult,
      isClassificationOpen: false
    };
  }

  componentDidUpdate (prevProps) {
    if (prevProps !== this.props) {
      this.setState({testResult: this.props.testResult});
    }
  }

  onClassificationToggle = () => {
    this.setState({isClassificationOpen: !this.state.isClassificationOpen});
  };

  onClassificationSelect = (_event, selection) => {
    let testResult = this.state.testResult;
    testResult['metadata']['classification'] = selection;
    this.setState({testResult: testResult, isClassificationOpen: !this.state.isClassificationOpen});
    HttpClient.put([Settings.serverUrl, 'result', testResult['id']], {}, testResult);
  };

  render () {
    const testResult = this.state.testResult;
    return (
      <Dropdown
        isOpen={this.state.isClassificationOpen}
        onSelect={this.onClassificationSelect}
        onOpenChange={() => this.setState({isClassificationOpen: false})}
        toggle={toggleRef => (
          <MenuToggle
            ref={toggleRef}
            onClick={this.onClassificationToggle}
            isExpanded={this.state.isClassificationOpen}
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
    );
  }
}

export class MultiClassificationDropdown extends React.Component {
  static propTypes = {
    selectedResults: PropTypes.array,
    refreshFunc: PropTypes.func
  };

  constructor (props) {
    super(props);
    this.state = {
      isClassificationOpen: false
    };
  }

  onClassificationToggle = isOpen => {
    this.setState({isClassificationOpen: isOpen});
  };

  onClassificationSelect = event => {
    const { selectedResults } = this.props;
    let classification = event.target.getAttribute('value');
    if (selectedResults.length === 0) {
      this.setState({isClassificationOpen: !this.state.isClassificationOpen});
    }
    else {
      selectedResults.forEach(result => {
        result['metadata']['classification'] = classification;
        HttpClient.put([Settings.serverUrl, 'result', result['id']], {}, result)
          .then(this.props.refreshFunc());
      });
      this.setState({isClassificationOpen: !this.state.isClassificationOpen});
    }
  };

  render () {
    const { selectedResults } = this.props;
    return (
      <Dropdown
        isOpen={this.state.isClassificationOpen}
        onSelect={this.onClassificationSelect}
        onOpenChange={() => this.setState({isClassificationOpen: false})}
        toggle={toggleRef => (
          <MenuToggle
            ref={toggleRef}
            isDisabled={selectedResults.length === 0}
            onClick={this.onClassificationToggle}
            isExpanded={this.state.isClassificationOpen}
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
  }
}
