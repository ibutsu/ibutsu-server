import { PageSection, Content } from '@patternfly/react-core';

const AdminHome = () => (
  <>
    <PageSection hasBodyWrapper={false} id="page">
      <Content>
        <Content className="title" component="h1" ouiaId="admin">
          Administration
        </Content>
      </Content>
    </PageSection>
    <PageSection hasBodyWrapper={false} />
  </>
);

AdminHome.propTypes = {};

export default AdminHome;
