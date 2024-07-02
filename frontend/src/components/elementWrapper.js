// Wrapper
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PropTypes from 'prop-types';


const ElementWrapper = (props) => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const Element = props.routeElement;
  const eventEmitter = props.eventEmitter

  return <Element eventEmitter={eventEmitter} location={location} navigate={navigate} params={params} />;
};

ElementWrapper.propTypes = {
    eventEmitter: PropTypes.object,
    routeElement: PropTypes.func,
};

export default ElementWrapper;
