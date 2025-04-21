import PropTypes from 'prop-types';
import { TabTitleIcon, TabTitleText } from '@patternfly/react-core';

const TabTitle = (props) => {
  const { icon, text } = props;
  return (
    <>
      <TabTitleIcon>{icon}</TabTitleIcon>
      <TabTitleText>{text?.toString()}</TabTitleText>
    </>
  );
};

TabTitle.propTypes = {
  icon: PropTypes.object,
  text: PropTypes.string,
};

export default TabTitle;
