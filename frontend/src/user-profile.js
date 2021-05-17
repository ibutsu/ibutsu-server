import React from 'react';
import {
  Alert,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';


export class UserProfile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null
    };
  }

  getUser() {
    HttpClient.get([Settings.serverUrl, 'user'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(user => this.setState({user}))
      .catch(error => console.error(error));
  }

  componentDidMount() {
    this.getUser();
  }

  render() {
    const { user } = this.state;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1" className="pf-c-title">Profile</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          {!user && <Alert variant="danger" title="Error fetching user details" />}
          {user &&
          <DataList selectedDataListItemId={null} aria-label="User profile">
            <DataListItem aria-labelledby="Name">
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key={1} width={2}><strong>Name:</strong></DataListCell>,
                    <DataListCell key={2} width={4}>{user.name}</DataListCell>
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
            <DataListItem aria-labelledby="E-mail">
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key={1} width={2}><strong>E-mail:</strong></DataListCell>,
                    <DataListCell key={2} width={4}>{user.email}</DataListCell>
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          </DataList>
          }
        </PageSection>
      </React.Fragment>
    );
  }
}
