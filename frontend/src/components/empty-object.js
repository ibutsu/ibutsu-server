import PropTypes from 'prop-types';
import React from 'react';

import {
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Text
} from '@patternfly/react-core';
import {
  SearchIcon
} from '@patternfly/react-icons';

import { NavLink } from 'react-router-dom';

export class EmptyObject extends React.Component {
  static propTypes = {
    headingText: PropTypes.string,
    bodyText: PropTypes.string,
    returnLink: PropTypes.string,
    returnLinkText: PropTypes.string
  };
  render() {
    return (
      <React.Fragment>
        <EmptyState>
          <EmptyStateIcon icon={SearchIcon} />
          <Text headingLevel="h1" size="lg">
            {!this.props.headingText &&
            <Text>This object couldn&apos;t be found.</Text>}
            {this.props.headingText}
          </Text>
          <EmptyStateBody>
            {!this.props.bodyText &&
            <Text>Either the object doesn&apos;t exist or the ID is invalid.</Text>}
            {this.props.bodyText}
          </EmptyStateBody>
          <NavLink style={{ color: 'white' }} to={!this.props.returnLink ?  '' : this.props.returnLink}>
            <Button variant="primary" style = {{ margin: '25px' }}>
              {!this.props.returnLinkText &&
              <Text>Return to dashboard</Text>}
              {this.props.returnLinkText}
            </Button>
          </NavLink>
        </EmptyState>
      </React.Fragment>
    );
  }
}
