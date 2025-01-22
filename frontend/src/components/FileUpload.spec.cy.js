import { mount } from 'cypress/react';
import React from 'react';

import { FileUpload } from '.';

describe('FileUpload', () => {

  it('should render without crashing', () => {
    mount(<FileUpload url='/upload'/>);
    cy.get('button');
  });

});
