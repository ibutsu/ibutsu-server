import React from 'react';
import { render } from '@testing-library/react';
import { Base } from './base';

it('renders without crashing', () => {
  render(<Base />);
});
