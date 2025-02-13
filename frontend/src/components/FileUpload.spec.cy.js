import { mount } from 'cypress/react';
import React from 'react';

import { FileUpload } from '.';
import { IbutsuContext } from '../services/context';

describe('FileUpload', () => {

  it('should render without crashing', () => {
    mount(<FileUpload url='/upload'/>);
    cy.get('button');
  });

  it('should fire the beforeUpload when a file is changed', () => {
    const beforeUpload = cy.spy().as('buSpy');
    mount(
      <IbutsuContext.Provider value={{'primaryObject': {'id': '1234'}}}>
        <FileUpload url='/upload' beforeUpload={beforeUpload}>Upload</FileUpload>
      </IbutsuContext.Provider>
    );
    cy.get('input[type="file"]')
      .selectFile({
        contents: 'cypress/fixtures/example.json',
      },
      {force: true, log: true});
    cy.get('@buSpy').should('have.been.called');
  });

  it('should upload the file and trigger the afterUpload event', () => {
    const afterUpload = cy.spy().as('auSpy');

    cy.intercept('POST', '/upload', {});
    mount(
      <IbutsuContext.Provider value={{'primaryObject': {'id': '1234'}}}>
        <FileUpload url='/upload' afterUpload={afterUpload}>Upload</FileUpload>
      </IbutsuContext.Provider>
    );
    cy.get('input[type="file"]')
      .selectFile({
        contents: 'cypress/fixtures/example.json',
      },
      {force: true, log: true});
    cy.get('@auSpy').should('have.been.called');
  });
});
