import React from 'react';
import PropTypes from 'prop-types';
import { Button, CardHeader, Title } from '@patternfly/react-core';
import {
  PficonHistoryIcon,
  TimesIcon,
  PencilAltIcon,
} from '@patternfly/react-icons';

const WidgetHeader = (props) => {
  const { id, getDataFunc, onDeleteClick, title, actions, onEditClick } = props;

  const headerActions = (
    <React.Fragment>
      {actions ? actions : []}
      {getDataFunc && (
        <Button
          variant="plain"
          onClick={() => {
            getDataFunc();
          }}
          title="Refresh"
          aria-label="Refresh"
          isInline
        >
          <PficonHistoryIcon />
        </Button>
      )}
      {onEditClick && (
        <Button
          variant="plain"
          onClick={() => {
            onEditClick();
          }}
          title="Edit"
          aria-label="Edit"
          isInline
        >
          <PencilAltIcon />
        </Button>
      )}
      {onDeleteClick && (
        <Button
          variant="plain"
          onClick={() => {
            onDeleteClick();
          }}
          title="Remove from dashboard"
          aria-label="Delete"
          isInline
        >
          <TimesIcon />
        </Button>
      )}
    </React.Fragment>
  );

  return (
    <CardHeader
      id={id}
      data-id="widget-header"
      actions={{ actions: headerActions }}
    >
      <Title headingLevel="h2">{title}</Title>
    </CardHeader>
  );
};

WidgetHeader.propTypes = {
  id: PropTypes.string,
  getDataFunc: PropTypes.func,
  onDeleteClick: PropTypes.func,
  title: PropTypes.string,
  actions: PropTypes.array,
  onEditClick: PropTypes.func,
};

export default WidgetHeader;
