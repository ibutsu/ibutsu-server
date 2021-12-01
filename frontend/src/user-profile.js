import React from 'react';
import {
  Alert,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  Label,
  PageSection,
  PageSectionVariants,
  Title
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';


export class UserProfile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      projects: null
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

  getProjects() {
    HttpClient.get([Settings.serverUrl, 'project'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => this.setState({projects: data.projects}))
      .catch(error => console.error(error));
  }

  componentDidMount() {
    this.getUser();
    this.getProjects();
  }

  render() {
    const { user, projects } = this.state;
    let projectInfo = [];
    // create the project rows
    if (projects && user) {
      projectInfo.push(projects.map((project) => (
            <DataListCell key={project.name} className="pf-u-p-sm">
              <span> {project.title} </span>
              {project.owner_id === user.id &&
                <Label className="project-owner-label" variant="outline" color="green"> Owner </Label>
              }
            </DataListCell>
      )))
    }
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h1" size='2xl' className="pf-c-title">
            <React.Fragment>
              <span> Profile </span>
              {user && user.is_superadmin &&
                <Label className="super-admin-label" variant="outline" color="blue"> Super Administrator</Label>
              }
            </React.Fragment>
          </Title>
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
            <DataListItem aria-labelledby="Projects">
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key={1} width={2}><strong>My Projects:</strong></DataListCell>,
                    <DataListCell key={2} width={4} style={{paddingTop: 0, paddingBottom: 0}}>
                      <DataList aria-lable="projects" style={{borderTop: "none"}}>
                        {projects &&
                          projectInfo
                        }
                      </DataList>
                    </DataListCell>
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
