import React from 'react';

import {
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';

const AdminHome = () => (
  <React.Fragment>
    <PageSection id="page" variant={PageSectionVariants.light}>
      <TextContent>
        <Text className="title" component="h1" ouiaId="admin">Administration</Text>
      </TextContent>
    </PageSection>
    <PageSection />
  </React.Fragment>
);

AdminHome.propTypes = {};

export default AdminHome;
