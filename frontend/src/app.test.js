import { render } from '@testing-library/react';
import { Base } from './routes/base';

describe('Render full app', () => {
  beforeEach(() => {
    // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,

      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
      })),
    });
  });
  it('renders without crashing', () => {
    render(<Base />);
  });
});
