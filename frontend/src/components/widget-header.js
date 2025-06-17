import React from 'react';
import PropTypes from 'prop-types';
import { Button, CardHeader, Title } from '@patternfly/react-core';
import {
  PficonHistoryIcon,
  TimesIcon,
  PencilAltIcon,
} from '@patternfly/react-icons';

const WidgetHeader = ({
  id,
  getDataFunc,
  onDeleteClick,
  title,
  actions,
  onEditClick,
}) => {
  const headerActions = (
    <React.Fragment>
      {actions ? actions : []}
      {getDataFunc && (
        <Button
          icon={<PficonHistoryIcon />}
          variant="plain"
          onClick={() => {
            getDataFunc();
          }}
          title="Refresh"
          aria-label="Refresh"
          isInline
        />
      )}
      {onEditClick && (
        <Button
          icon={<PencilAltIcon />}
          variant="plain"
          onClick={() => {
            onEditClick();
          }}
          title="Edit"
          aria-label="Edit"
          isInline
        />
      )}
      {onDeleteClick && (
        <Button
          icon={<TimesIcon />}
          variant="plain"
          onClick={() => {
            onDeleteClick();
          }}
          title="Remove from dashboard"
          aria-label="Delete"
          isInline
        />
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
