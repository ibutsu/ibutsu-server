import React from 'react';
import PropTypes from 'prop-types';

import { HttpClient } from '../services/http';
import { IbutsuContext } from '../services/context';
import { Button } from '@patternfly/react-core';

export class FileUpload extends React.Component {
  // TODO: refactor to functional
  // TODO: Consider explicit project selection for upload instead of inferred from context
  static contextType = IbutsuContext;
  static propTypes = {
    url: PropTypes.string.isRequired,
    name: PropTypes.string,
    multiple: PropTypes.bool,
    onClick: PropTypes.func,
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
      onClick: props.onClick ? props.onClick : null,
      beforeUpload: props.beforeUpload ? props.beforeUpload : null,
      afterUpload: props.afterUpload ? props.afterUpload : null
    };
    this.inputRef = React.createRef();
  }

  onUploadClick = (e) => {
    if (this.state.onClick) {
      this.state.onClick(e);
    }
    this.inputRef.current.click();
  }

  onFileChange = (e) => {
    let files = e.target.files || e.dataTransfer.files;
    if (files.length > 0) {
      if (this.state.beforeUpload) {
        this.state.beforeUpload(files);
      }
      this.uploadFile(files[0]);
      // Clear the upload field
      this.inputRef.current.value = "";
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
      if (this.state.afterUpload) {
        this.state.afterUpload(response);
      }
    });
  }

  render() {
    const { children, className } = this.props;
    const styles = this.props.isUnstyled ? {} : {cursor: 'pointer', display: 'inline', padding: '0', margin: '0'};
    const { primaryObject } = this.context;
    return (
      <React.Fragment>
        <input type="file" multiple={this.state.multiple} style={{display: 'none'}} onChange={this.onFileChange} ref={this.inputRef} />
        <Button className={className} style={styles} onClick={this.onUploadClick} isDisabled={!primaryObject}>
          {children}
        </Button>
      </React.Fragment>
    );
  }
}
