/* eslint-env jest */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHome from './home';

describe('AdminHome Component', () => {
  const renderAdminHome = () => {
    return render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>,
    );
  };

  it('should render the Administration heading', () => {
    renderAdminHome();

    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should render PageSection components', () => {
    const { container } = renderAdminHome();

    // Check that PageSection elements are rendered
    const pageSections = container.querySelectorAll('[id="page"]');
    expect(pageSections.length).toBeGreaterThan(0);
  });

  it('should have the correct heading level', () => {
    renderAdminHome();

    const heading = screen.getByText('Administration');
    expect(heading.tagName).toBe('H1');
  });

  it('should render without crashing', () => {
    const { container } = renderAdminHome();
    expect(container).toBeTruthy();
  });
});
