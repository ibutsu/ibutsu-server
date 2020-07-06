import React from 'react';
import { mount } from 'enzyme';

import { FileUpload } from './components';
import { setupTests } from './setupTests';

beforeAll(setupTests);

describe('FileUpload', () => {

  it('should render without crashing', () => {
    const wrapper = mount(<FileUpload url="/upload" />);
    expect(wrapper.props().url).toEqual('/upload');
  });

  it('should run the onClick method via onUploadClick', () => {
    const onClick = jest.fn();
    const wrapper = mount(<FileUpload url="/upload" onClick={onClick}>Upload</FileUpload>);
    const button = wrapper.find('button');
    button.simulate('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should fire the beforeUpload when a file is changed', () => {
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
  });
});
