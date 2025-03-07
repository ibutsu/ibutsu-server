import PropTypes from 'prop-types';
import React from 'react';

import {
  Button,
  EmptyState,
  EmptyStateFooter,
  EmptyStateHeader,
  EmptyStateIcon,
  EmptyStateBody,
  Text
} from '@patternfly/react-core';
import {
  SearchIcon
} from '@patternfly/react-icons';

import { NavLink } from 'react-router-dom';

const EmptyObject = (props) => {
  const {
    headingText,
    bodyText,
    returnLink,
    returnLinkText
  } = props;

  return (
    <React.Fragment>
      <EmptyState>
        <EmptyStateHeader icon={<EmptyStateIcon icon={SearchIcon} />} />
        <Text component="h1" size="lg">
          {headingText ? headingText : 'This object couldn\'t be found.'}
        </Text>
        <EmptyStateBody>
          {bodyText ? bodyText : 'Either the object doesn\'t exist or the ID is invalid.'}
        </EmptyStateBody>
        <EmptyStateFooter>
          <NavLink style={{ color: 'white' }} to={!returnLink ?  '' : returnLink}>
            <Button variant="primary" style = {{ margin: '25px' }}>
              {returnLinkText ? returnLinkText : 'Return to dashboard'}
            </Button>
          </NavLink>
        </EmptyStateFooter>
      </EmptyState>
    </React.Fragment>
  );
};

EmptyObject.propTypes = {
  headingText: PropTypes.string,
  bodyText: PropTypes.string,
  returnLink: PropTypes.string,
  returnLinkText: PropTypes.string
};

export default EmptyObject;
