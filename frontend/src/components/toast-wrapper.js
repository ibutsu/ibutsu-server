import { Alert, Icon } from '@patternfly/react-core';

const ToastWrapper = ({ data }) => (
  <Alert
    key={data.key}
    customIcon={<Icon />}
    title={data.title}
    actionLinks={data.action}
  >
    {data.message}
  </Alert>
);

export default ToastWrapper;
