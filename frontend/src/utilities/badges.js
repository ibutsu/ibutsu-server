import { Badge, Button } from '@patternfly/react-core';
import { MISSING_META_EXCEPTION } from '../constants';

export const buildBadge = (key, value, isRead, onClick) => {
  // Ensure value is a string to avoid React child errors
  let displayValue = value;

  if (typeof value === 'object' && value !== null) {
    console.error('buildBadge: Object value passed as badge content:', value);
    displayValue = JSON.stringify(value);
  } else if (value === null || value === undefined) {
    displayValue = 'N/A';
  }

  const badge = (
    <Badge key={key} isRead={isRead}>
      {displayValue}
    </Badge>
  );
  if (onClick) {
    return (
      <Button key={key} variant="link" style={{ padding: 0 }} onClick={onClick}>
        {badge}
      </Button>
    );
  } else {
    return badge;
  }
};

export const exceptionToBadge = (exception = null, filterFunc) => {
  let exceptionBadge;
  let exceptionName = exception || MISSING_META_EXCEPTION;

  if (filterFunc && exception) {
    exceptionBadge = buildBadge('exception_name', exceptionName, false, () =>
      filterFunc({
        field: 'metadata.exception_name',
        operator: 'eq',
        value: exceptionName,
      }),
    );
  } else {
    exceptionBadge = buildBadge('exception_name', exceptionName, false);
  }

  return exceptionBadge;
};

// TODO envToBadge and componentToBadge functions, with MISSING_ constants
