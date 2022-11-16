import { mount } from 'cypress/react';
import React from 'react';

import { FileUpload } from '.';

describe('FileUpload', () => {

  it('should render without crashing', () => {
    mount(<FileUpload url='/upload'/>);
    cy.get('button');
  });

  it('should run the onClick method via onUploadClick', () => {
    const onClick = cy.spy().as('uploadSpy');
    mount(<FileUpload url='/upload' onClick={onClick}>Upload</FileUpload>);
    cy.get('button').click();
    cy.get('@uploadSpy').should('have.been.calledOnce');
  });

  it('should fire the beforeUpload when a file is changed', () => {
    const beforeUpload = cy.spy().as('buSpy');
    mount(<FileUpload url='/upload' beforeUpload={beforeUpload}>Upload</FileUpload>);
    cy.get('input[type="file"]')
      .selectFile({
        contents: 'cypress/fixtures/example.json',
      },
      {force: true, log: true});
    cy.get('@buSpy').should('have.been.called');
  });

  it('should upload the file and trigger the afterUpload event', () => {
    const afterUpload = cy.spy().as('auSpy');
    mount(<FileUpload url='/upload' afterUpload={afterUpload}>Upload</FileUpload>);
    cy.get('input[type="file"]')
      .selectFile({
        contents: 'cypress/fixtures/example.json',
      },
      {force: true, log: true});
    cy.get('@auSpy').should('have.been.called');
  });
});
