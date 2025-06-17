import React from 'react';

import { PageSection, Content } from '@patternfly/react-core';

const AdminHome = () => (
  <React.Fragment>
    <PageSection hasBodyWrapper={false} id="page">
      <Content>
        <Content className="title" component="h1" ouiaId="admin">
          Administration
        </Content>
      </Content>
    </PageSection>
    <PageSection hasBodyWrapper={false} />
  </React.Fragment>
);

AdminHome.propTypes = {};

export default AdminHome;
