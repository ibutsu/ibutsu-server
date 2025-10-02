import { Badge, Button } from '@patternfly/react-core';

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
