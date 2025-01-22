import React, { useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import UploadIcon from '@patternfly/react-icons/dist/esm/icons/upload-icon';


import { HttpClient } from '../services/http';
import { IbutsuContext } from '../services/context';
import { AlertActionLink, Button, ButtonVariant, Icon, Tooltip } from '@patternfly/react-core';
import { getDarkTheme } from '../utilities';
import { toast } from 'react-toastify';
import ToastWrapper from './toast-wrapper';
import { Settings } from '../settings';
import { ALERT_TIMEOUT } from '../constants';


const FileUpload = (props) => {
  const context = useContext(IbutsuContext);

  const [importId, setImportId] = useState();

  const inputRef = useRef();
  const importToastRef = useRef();
  const intervalId = useRef();

  const name = props?.name ? props.name : 'file';


  function onClick() {
    inputRef.current.click();
  }

  function onFileChange(e) {
    let files = e.target.files || e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
      // Clear the upload field
      inputRef.current.value = '';
    }
  }

  function checkImportStatus() {
    const { primaryObject } = context;
    if(importId) {
      HttpClient.get([Settings.serverUrl, 'import', importId])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data['status'] === 'done') {
          clearInterval(intervalId.current);
          setImportId();
          let action = null;
          if (data.metadata.run_id) {
            const RunButton = () => (
              <AlertActionLink component='a' href={'/project/' + (data.metadata.project_id || primaryObject.id) + '/runs/' + data.metadata.run_id}>
                Go to Run
              </AlertActionLink>
            )
            action = <RunButton />;
          }
          toast.update(importToastRef.current,
            {
              data: {
                type:'success',
                title:'Import Complete',
                message: `${data.filename} has been successfully imported as run ${data.metadata.run_id}`,
                action: action
              },
              type: 'success',
              autoClose: ALERT_TIMEOUT
            }
          )

        }
      });
    }
  }

  function uploadFile(file) {
    const files = {};
    const { primaryObject } = context;
    files[name] = file;

    HttpClient.upload(
      Settings.serverUrl+'/import',
      files,
      {'project': primaryObject?.id}
    )
    .then((response) => HttpClient.handleResponse(response, 'response'))
    .then(data => {
      data.json().then((importObject) => {
        importToastRef.current = toast(<ToastWrapper />,
          {
            data: {
              type: 'info',
              title: 'Import Starting',
              message: importObject.filename + ' is being imported...'
            },
            type: 'info',
            theme: getDarkTheme() ? 'dark' : 'light'
          }
        );
        setImportId(importObject['id']);
        intervalId.current = setInterval(checkImportStatus, 5000);
        })
    })
    .catch(error => {
      toast.update(importToastRef.current,
        {
          data: {
            type: 'danger',
            title: 'Import Error',
            message: 'There was a problem uploading your file: ' + error
          },
          type: 'error'
        }
      );
    });
  }

  const {primaryObject} = context;
  return (
    <React.Fragment>
      <input type="file" multiple={false} style={{display: 'none'}} onChange={onFileChange} ref={inputRef} />
      <Tooltip content="Upload xUnit XML or Ibutsuresult archive to the selected project.">
        <Button variant={ButtonVariant.tertiary} icon={<Icon><UploadIcon/></Icon>} onClick={onClick} isAriaDisabled={!primaryObject}>
        Import</Button>
      </Tooltip>
    </React.Fragment>
  );

}

FileUpload.propTypes = {
  name: PropTypes.string,
};

export default FileUpload;
