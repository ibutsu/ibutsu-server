import React from 'react';
import PropTypes from 'prop-types';

export class FileUpload extends React.Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
    name: PropTypes.string,
    params: PropTypes.object,
    multiple: PropTypes.bool,
    onClick: PropTypes.func,
    beforeUpload: PropTypes.func,
    afterUpload: PropTypes.func,
    children: PropTypes.node,
    className: PropTypes.node,
    component: PropTypes.node,
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
    this.buttonRef = React.createRef();
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
    // Upload the file
    const formData = new FormData();
    formData.append(this.state.name, file);
    if (this.props.params) {
      Object.keys(this.props.params).forEach(key => {
        formData.append(key, this.props.params[key]);
      });
    }
    fetch(this.state.url, {method: 'POST', body: formData}).then((response) => {
      if (this.state.afterUpload) {
        this.state.afterUpload(response);
      }
    });
  }

  render() {
    const { children, className } = this.props;
    const Component = this.props.component || 'button';
    const styles = this.props.isUnstyled ? {} : {cursor: 'pointer', display: 'inline', padding: '0', margin: '0'};
    return (
      <React.Fragment>
        <input type="file" multiple={this.state.multiple} style={{display: 'none'}} onChange={this.onFileChange} ref={this.inputRef} />
        <Component className={className} style={styles} onClick={this.onUploadClick} ref={this.buttonRef}>
          {children}
        </Component>
      </React.Fragment>
    );
  }
}
