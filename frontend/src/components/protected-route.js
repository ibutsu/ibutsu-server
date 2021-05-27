import React from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';

export const ProtectedRoute = ({
  component: Component,
  isLoggedIn,
  redirectRoute,
  ...rest
}) => {
  return (
    <Route
      {...rest}
      render={props => {
        if (!isLoggedIn) {
          return <Redirect to={redirectRoute} />;
        }
        else {
          return <Component {...props} />;
        }
      }}
    />
  );
};

ProtectedRoute.propTypes = {
  component: PropTypes.elementType,
  isLoggedIn: PropTypes.bool,
  redirectRoute: PropTypes.any
};
