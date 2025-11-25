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
  ouiaId,
}) => {
  const headerActions = (
    <>
      {actions ? actions : []}
      {getDataFunc && (
        <Button
          key="refresh"
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
          key="edit"
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
          key="delete"
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
    </>
  );

  return (
    <CardHeader
      id={id}
      data-id="widget-header"
      actions={{ actions: headerActions }}
      ouiaId={ouiaId ?? (id ? `${id}-header` : 'widget-header')}
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
  ouiaId: PropTypes.string,
};

export default WidgetHeader;
