import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  InputGroup,
  InputGroupItem,
  Label,
  PageSection,
  PageSectionVariants,
  TextInput,
  Title
} from '@patternfly/react-core';
import { CheckIcon, PencilAltIcon, TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';


export class UserProfile extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object
  };

  constructor (props) {
    super(props);
    this.eventEmitter = props.eventEmitter;
    this.state = {
      user: null,
      projects: null,
      isEditing: false
    };
  }

  showNotification (type, title, message, action?, timeout?, key?) {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('showNotification', type, title, message, action, timeout, key);
  }

  updateUserName (userName) {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('updateUserName', userName);
  }

  getUser () {
    HttpClient.get([Settings.serverUrl, 'user'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(user => this.setState({user}))
      .catch(error => console.error(error));
  }

  getProjects () {
    HttpClient.get([Settings.serverUrl, 'project'])
      .then(response => HttpClient.handleResponse(response, 'response').json())
      .then(data => this.setState({projects: data.projects}))
      .catch(error => console.error(error));
  }

  saveUser (user) {
    return HttpClient.put([Settings.serverUrl, 'user'], {}, user)
      .then(response => HttpClient.handleResponse(response))
      .catch(error => console.error(error));
  }

  onEditButtonClicked = () => {
    this.setState({tempName: this.state.user.name, isEditing: true});
  };

  onCancelButtonClicked = () => {
    this.setState({isEditing: false});
  };

  onSaveButtonClicked = () => {
    const { user, tempName } = this.state;
    let tempUser = Object.assign({}, user, {name: tempName});
    this.saveUser(tempUser).then(response => {
      if (response !== undefined) {
        this.showNotification('success', 'Name Updated', 'Your name has been updated.');
        this.setState({user: tempUser, isEditing: false});
        this.updateUserName(tempName);
      }
      else {
        this.showNotification('danger', 'Error Updating', 'There was an error trying to save your name');
        this.setState({isEditing: false});
      }
    });
  };

  componentDidMount () {
    this.getUser();
    this.getProjects();
  }

  render () {
    document.title = 'Profile | Ibutsu';

    const { user, projects } = this.state;
    let projectInfo = [];
    // create the project rows
    if (projects && user) {
      projectInfo.push(projects.map((project) => (
        <DataListCell key={project.name} className="pf-u-p-sm">
          <span> {project.title} </span>
          {project.owner_id === user.id &&
                <Label className="project-owner-label" variant="filled" color="green" isCompact>Owner</Label>
          }
        </DataListCell>
      )));
    }
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h1" size='2xl' className="pf-v5-c-title">
            <React.Fragment>
              <span> Profile </span>
              {user && user.is_superadmin &&
                <Label className="super-admin-label" variant="filled" color="blue">Administrator</Label>
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
                {!this.state.isEditing &&
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key={1} width={2}><strong>Name:</strong></DataListCell>,
                      <DataListCell key={2} width={4}>{user.name} <Button variant="link" icon={<PencilAltIcon />} onClick={this.onEditButtonClicked} isInline size="sm" ouiaId="edit-profile-button">Edit</Button></DataListCell>
                    ]}
                  />
                }
                {this.state.isEditing &&
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key={1} width={2}><strong>Name:</strong></DataListCell>,
                      <DataListCell key={2} width={4}>
                        <InputGroup>
                          <InputGroupItem isFill ><TextInput value={this.state.tempName} type="text" onChange={(_event, value) => this.setState({tempName: value})} aria-label="User name" /></InputGroupItem>
                          <InputGroupItem>
                            <Button variant="control" icon={<CheckIcon />} onClick={this.onSaveButtonClicked} ouiaId="edit-save-button">
                              Save
                            </Button>
                          </InputGroupItem>
                          <InputGroupItem>
                            <Button variant="control" icon={<TimesIcon />} onClick={this.onCancelButtonClicked} ouiaId="edit-cancel-button">
                              Cancel
                            </Button>
                          </InputGroupItem>
                        </InputGroup>
                      </DataListCell>
                    ]}
                  />
                }
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
                      <DataList aria-label="projects" style={{borderTop: 'none'}}>
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
