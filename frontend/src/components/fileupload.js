import React from 'react';
import PropTypes from 'prop-types';

import { HttpClient } from '../services/http';
import { IbutsuContext } from '../services/context';
import { Button, Tooltip } from '@patternfly/react-core';

export class FileUpload extends React.Component {
  // TODO: refactor to functional
  // TODO: Consider explicit project selection for upload instead of inferred from context
  static contextType = IbutsuContext;
  static propTypes = {
    url: PropTypes.string.isRequired,
    name: PropTypes.string,
    multiple: PropTypes.bool,
    beforeUpload: PropTypes.func,
    afterUpload: PropTypes.func,
    children: PropTypes.node,
    className: PropTypes.node,
    isUnstyled: PropTypes.bool,
  }

  constructor(props) {
    super(props);
    this.state = {
      url: props.url,
      name: props.name ? props.name : 'file',
      multiple: !!props.multiple,
      beforeUpload: props.beforeUpload ? props.beforeUpload : Function.prototype,
      afterUpload: props.afterUpload ? props.afterUpload : Function.prototype
    };
    this.inputRef = React.createRef();
  }

  onClick = () => {
    this.inputRef.current.click();
  }

  onFileChange = (e) => {
    let files = e.target.files || e.dataTransfer.files;
    if (files.length > 0) {
      this.state.beforeUpload(files);
      this.uploadFile(files[0]);
      // Clear the upload field
      this.inputRef.current.value = '';
    }
  }

  uploadFile = (file) => {
    const files = {};
    const { primaryObject } = this.context;
    files[this.state.name] = file;
    HttpClient.upload(
      this.state.url,
      files,
      {'project': primaryObject?.id}
    ).then((response) => {
      response = HttpClient.handleResponse(response, 'response');
      this.state.afterUpload(response);
    });
  }

  render() {
    const { children, className } = this.props;
    const { primaryObject } = this.context;
    return (
      <React.Fragment>
        <input type="file" multiple={this.state.multiple} style={{display: 'none'}} onChange={this.onFileChange} ref={this.inputRef} />
        <Tooltip content="Upload a result archive to the selected project.">
          <Button className={className} onClick={this.onClick} isAriaDisabled={!primaryObject}>
            {children}
          </Button>
        </Tooltip>
      </React.Fragment>
    );
  }
}
