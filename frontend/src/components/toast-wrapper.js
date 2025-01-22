import { Alert, Icon } from '@patternfly/react-core'
import PropTypes from 'prop-types';


const ToastWrapper = ({data}) => (
    <Alert key={data.key} customIcon={<Icon/>} title={data.title} actionLinks={data.action}>
        {data.message}
    </Alert>
);

ToastWrapper.propTypes = {
    data: PropTypes.object,
}

export default ToastWrapper;
