import React from 'react';
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

export class FileUpload extends React.Component {
  // TODO: refactor to functional
  // TODO: Consider explicit project selection for upload instead of inferred from context
  // TODO: support multiple upload
  static contextType = IbutsuContext;
  static propTypes = {
    url: PropTypes.string.isRequired,
    name: PropTypes.string,
    children: PropTypes.node,
  }

  constructor(props) {
    super(props);
    this.state = {
      url: props.url,
      name: props.name ? props.name : 'file',
      importId: null,
      intervalId: null
    };
    this.inputRef = React.createRef();
    this.importToastRef = React.createRef();
    this.intervalId = React.createRef();

  }

  onClick = () => {
    this.inputRef.current.click();
  }

  onFileChange = (e) => {
    let files = e.target.files || e.dataTransfer.files;
    if (files.length > 0) {
      this.uploadFile(files[0]);
      // Clear the upload field
      this.inputRef.current.value = '';
    }
  }

  checkImportStatus = (importId) => {
    const { primaryObject } = this.context;

    HttpClient.get([Settings.serverUrl, 'import', importId])
    .then(response => HttpClient.handleResponse(response))
    .then(data => {
      if (data['status'] === 'done') {
        clearInterval(this.intervalId.current);
        this.importId = null;
        let action = null;
        if (data.metadata.run_id) {
          const RunButton = () => (
            <AlertActionLink component='a' href={'/project/' + (data.metadata.project_id || primaryObject.id) + '/runs/' + data.metadata.run_id}>
              Go to Run
            </AlertActionLink>
          )
          action = <RunButton />;
        }
        toast.update(this.importToastRef.current,
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

  uploadFile = (file) => {
    const files = {};
    const { primaryObject } = this.context;
    files[this.state.name] = file;

    HttpClient.upload(
      this.state.url,
      files,
      {'project': primaryObject?.id}
    )
    .then((response) => HttpClient.handleResponse(response, 'response'))
    .then(data => {
      data.json().then((importObject) => {
        this.importToastRef.current = toast(<ToastWrapper />,
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
        this.intervalId.current = setInterval(() => {this.checkImportStatus(importObject['id'])}, 5000);
        })
    })
    .catch(error => {
      toast.update(this.importToastRef.current,
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

  render() {
    const { children } = this.props;
    const { primaryObject } = this.context;
    return (
      <React.Fragment>
        <input type="file" multiple={false} style={{display: 'none'}} onChange={this.onFileChange} ref={this.inputRef} />
        <Tooltip content="Upload a result archive to the selected project.">
          <Button variant={ButtonVariant.tertiary} icon={<Icon><UploadIcon/></Icon>} onClick={this.onClick} isAriaDisabled={!primaryObject}>
            {children}
          </Button>
        </Tooltip>
      </React.Fragment>
    );
  }
}
