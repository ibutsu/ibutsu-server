import { TabTitleIcon, TabTitleText } from '@patternfly/react-core';

const TabTitle = ({ icon, text }) => {
  return (
    <>
      <TabTitleIcon>{icon}</TabTitleIcon>
      <TabTitleText>{text?.toString()}</TabTitleText>
    </>
  );
};

export default TabTitle;
