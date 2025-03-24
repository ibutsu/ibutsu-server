import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
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
  Title,
  Skeleton
} from '@patternfly/react-core';
import { CheckIcon, PencilAltIcon, TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { toast } from 'react-toastify';
import { getDarkTheme } from '../../utilities';
import ToastWrapper from '../../components/toast-wrapper';


const UserProfile = () => {
  const [user, setUser] = useState();
  const [projects, setProjects] = useState();
  const [isEditing, setIsEditing] = useState();
  const [isError, setIsError] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    // get user
    HttpClient.get([Settings.serverUrl, 'user'])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setUser(data);
      })
      .catch(error => {
        console.error(error);
        setIsError(true);
      });
  }, []);

  useEffect(() => {
    // get projects
    HttpClient.get([Settings.serverUrl, 'project'])
      .then(response => HttpClient.handleResponse(response))
      .then(data => setProjects(data.projects))
      .catch(error => console.error(error));
  }, []);

  const onSaveButtonClicked = () => {
    let tempUser = {...user, 'name': tempName};
    HttpClient.put([Settings.serverUrl, 'user'], {}, user)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data) {
          toast(<ToastWrapper/>, {
            data: {
              type: 'success',
              title: 'Name Updated',
              message: 'Your name has been updated.'
            },
            type: 'success',
            theme: getDarkTheme() ? 'dark' : 'light'
          });
          setUser(tempUser);
          setIsEditing(false);
        } else {
          toast(ToastWrapper,
            {
              data: {
                type: 'danger',
                title: 'Error Updating',
                message: 'Your name has NOT been updated.'
              },
              type: 'danger',
              theme: getDarkTheme() ? 'dark' : 'light'
            });
          setIsEditing(false);
        }
      })
      .catch(error => console.error(error));
  };

  useEffect(() => { document.title = 'Profile | Ibutsu'; }, []);

  return (
    <React.Fragment>
      <PageSection variant={PageSectionVariants.light}>
        <Title headingLevel="h1" size='2xl'>
          <React.Fragment>
            <span> Profile </span>
            {user && user.is_superadmin &&
              <Label className="super-admin-label" variant="filled" color="blue">Administrator</Label>
            }
          </React.Fragment>
        </Title>
      </PageSection>
      <PageSection>
        {isError && <Alert variant="danger" title="Error fetching user details" />}
        {!isError &&
          <Card>
            <CardBody>
              {!user && <Skeleton></Skeleton>}
              {user &&
                <DataList selectedDataListItemId={null} aria-label="User profile">
                  <DataListItem aria-labelledby="Name">
                    <DataListItemRow>
                      {!isEditing &&
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key={1} width={2}><strong>Name:</strong></DataListCell>,
                            <DataListCell key={2} width={4}>{user.name} <Button variant="link" icon={<PencilAltIcon />} onClick={() => {
                              setTempName(user.name);
                              setIsEditing(true);
                            }} isInline size="sm" ouiaId="edit-profile-button">Edit</Button></DataListCell>
                          ]}
                        />
                      }
                      {isEditing &&
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key={1} width={2}><strong>Name:</strong></DataListCell>,
                            <DataListCell key={2} width={4}>
                              <InputGroup>
                                <InputGroupItem isFill ><TextInput value={tempName} type="text" onChange={(_, value) => setTempName(value)} aria-label="User name" /></InputGroupItem>
                                <InputGroupItem>
                                  <Button variant="control" icon={<CheckIcon />} onClick={onSaveButtonClicked} ouiaId="edit-save-button">
                                    Save
                                  </Button>
                                </InputGroupItem>
                                <InputGroupItem>
                                  <Button variant="control" icon={<TimesIcon />} onClick={() => setIsEditing(false)} ouiaId="edit-cancel-button">
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
                                projects.map((project) => (
                                  <DataListCell key={project.name} className="pf-u-p-sm">
                                    <span> {project.title} </span>
                                    {project.owner_id === user.id &&
                                          <Label className="project-owner-label" variant="filled" color="green" isCompact>Owner</Label>
                                    }
                                  </DataListCell>
                                ))
                              }
                            </DataList>
                          </DataListCell>
                        ]}
                      />
                    </DataListItemRow>
                  </DataListItem>
                </DataList>
              }
            </CardBody>
          </Card>
        }
      </PageSection>
    </React.Fragment>
  );
};

UserProfile.propTypes = {};

export default UserProfile;
