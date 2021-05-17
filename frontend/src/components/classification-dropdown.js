import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  DropdownToggle
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { CLASSIFICATION } from '../constants.js';


export class ClassificationDropdown extends React.Component {
  static propTypes = {
    testResult: PropTypes.object,
  }

  constructor(props) {
    super(props);
    this.state = {
      testResult: this.props.testResult,
      isClassificationOpen: false
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      this.setState({testResult: this.props.testResult});
    }
  }

  onClassificationToggle = isOpen => {
    this.setState({isClassificationOpen: isOpen});
  }

  onClassificationSelect = event => {
    let testResult = this.state.testResult;
    testResult['metadata']['classification'] = event.target.getAttribute('value');
    this.setState({testResult: testResult, isClassificationOpen: !this.state.isClassificationOpen});
    HttpClient.put([Settings.serverUrl, 'result', testResult['id']], {}, testResult);
  }

  render() {
    const testResult = this.state.testResult;
    return (
      <Dropdown
        toggle={<DropdownToggle onToggle={this.onClassificationToggle}>{CLASSIFICATION[testResult.metadata && testResult.metadata.classification] || '(unset)'}</DropdownToggle>}
        onSelect={this.onClassificationSelect}
        isOpen={this.state.isClassificationOpen}
        dropdownItems={Object.keys(CLASSIFICATION).map((key) => <DropdownItem key={key} value={key}>{CLASSIFICATION[key]}</DropdownItem>)}
      />
    )
  }
}

export class MultiClassificationDropdown extends React.Component {
  static propTypes = {
    selectedResults: PropTypes.array,
    refreshFunc: PropTypes.func
  }

  constructor(props) {
    super(props);
    this.state = {
      isClassificationOpen: false
    };
  }

  onClassificationToggle = isOpen => {
    this.setState({isClassificationOpen: isOpen});
  }

  onClassificationSelect = event => {
    const { selectedResults } = this.props;
    let classification = event.target.getAttribute('value');
    if (selectedResults.length === 0) {
      this.setState({isClassificationOpen: !this.state.isClassificationOpen})
    }
    else {
      selectedResults.forEach(result => {
        result['metadata']['classification'] = classification;
        HttpClient.put([Settings.serverUrl, 'result', result['id']], {}, result)
          .then(this.props.refreshFunc());
      })
      this.setState({isClassificationOpen: !this.state.isClassificationOpen});
    }
  }

  render() {
    const { selectedResults } = this.props;
    return (
      <Dropdown
        toggle={<DropdownToggle isDisabled={selectedResults.length === 0} onToggle={this.onClassificationToggle}>{'Classify Selected Failures'}</DropdownToggle>}
        onSelect={this.onClassificationSelect}
        isOpen={this.state.isClassificationOpen}
        dropdownItems={Object.keys(CLASSIFICATION).map((key) => <DropdownItem key={key} value={key}>{CLASSIFICATION[key]}</DropdownItem>)}
      />
    )
  }
}
