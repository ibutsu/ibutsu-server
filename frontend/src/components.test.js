import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react'

import { FileUpload } from './components';

describe('FileUpload', () => {

  it('should render without crashing', () => {
    render(<FileUpload url="/upload" />);
    screen.getByRole('button', {url: /upload/i});
  });

  it('should run the onClick method via onUploadClick', () => {
    const onClick = jest.fn();
    render(<FileUpload url="/upload" onClick={onClick}>Upload</FileUpload>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  
/*   it('should fire the beforeUpload when a file is changed', () => {
    const beforeUpload = jest.fn();
    const wrapper = mount(<FileUpload url="/upload" beforeUpload={beforeUpload}>Upload</FileUpload>);
    const input = wrapper.find('input[type="file"]');
    input.simulate('change', {target: {files: ['test.txt']}});
    expect(beforeUpload).toHaveBeenCalledWith(['test.txt']);
  });

  xit('should upload the file and trigger the afterUpload event', () => {
    const afterUpload = jest.fn();
    const wrapper = mount(<FileUpload url="/upload" afterUpload={afterUpload}>Upload</FileUpload>);
    const input = wrapper.find('input[type="file"]');
    input.simulate('change', {target: {files: ['test.txt']}});
    expect(afterUpload).toHaveBeenCalledWith(['test.txt']);
  }); */
});
