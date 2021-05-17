import React from 'react';
import ReactDOM from 'react-dom';
import { Base } from './base';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<Base />, div);
  ReactDOM.unmountComponentAtNode(div);
});
