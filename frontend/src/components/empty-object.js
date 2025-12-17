import PropTypes from 'prop-types';

import {
  Button,
  EmptyState,
  EmptyStateFooter,
  EmptyStateBody,
  Content,
} from '@patternfly/react-core';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';

import { NavLink } from 'react-router-dom';

const EmptyObject = ({ headingText, bodyText, returnLink, returnLinkText }) => {
  return (
    <>
      <EmptyState icon={SearchIcon}>
        <Content component="h1" size="lg">
          {headingText ? headingText : "This object couldn't be found."}
        </Content>
        <EmptyStateBody>
          {bodyText
            ? bodyText
            : "Either the object doesn't exist or the ID is invalid."}
        </EmptyStateBody>
        <EmptyStateFooter>
          <NavLink
            style={{ color: 'white' }}
            to={!returnLink ? '' : returnLink}
          >
            <Button variant="primary" style={{ margin: '25px' }}>
              {returnLinkText ? returnLinkText : 'Return to dashboard'}
            </Button>
          </NavLink>
        </EmptyStateFooter>
      </EmptyState>
    </>
  );
};

EmptyObject.propTypes = {
  headingText: PropTypes.string,
  bodyText: PropTypes.string,
  returnLink: PropTypes.string,
  returnLinkText: PropTypes.string,
};

export default EmptyObject;
