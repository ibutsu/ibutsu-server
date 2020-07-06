import React from 'react';
import PropTypes from 'prop-types';
import { TabTitleIcon, TabTitleText } from '@patternfly/react-core';

export class TabTitle extends React.Component {
  propTypes = {
    icon: PropTypes.object,
    text: PropTypes.string
  }

  render() {
    const Icon = this.props.icon;
    return (
      <React.Fragment>
        <TabTitleIcon><Icon /></TabTitleIcon>
        <TabTitleText>{this.props.text}</TabTitleText>
      </React.Fragment>
    );
  }
}
