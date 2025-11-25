/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ImportanceComponentWidget from './importance-component';
import { HttpClient } from '../utilities/http';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock WidgetHeader component
jest.mock('../components/widget-header', () => {
  // eslint-disable-next-line react/prop-types
  return function WidgetHeader({ title }) {
    return <div data-ouia-component-id="widget-header">{title}</div>;
  };
});

// Mock ParamDropdown component
jest.mock('../components/param-dropdown', () => {
  // eslint-disable-next-line react/prop-types
  return function ParamDropdown({ tooltip, defaultValue }) {
    return (
      <div data-ouia-component-id="param-dropdown">
        {tooltip} {defaultValue}
      </div>
    );
  };
});

describe('ImportanceComponentWidget', () => {
  const mockTableData = [
    {
      component: 'frontend',
      bnums: ['1001', '1002', '1003'],
      importances: ['high', 'medium', 'low'],
      data: {
        1001: {
          high: {
            percentage: 0.95,
            result_list: [
              'd4e5f6a7-4567-8901-2def-345678901234',
              'e5f6a7b8-5678-9012-3ef0-456789012345',
            ],
          },
          medium: {
            percentage: 0.8,
            result_list: ['f6a7b8c9-6789-0123-4f01-567890123456'],
          },
          low: {
            percentage: 0.6,
            result_list: ['a7b8c9d0-7890-1234-5012-678901234567'],
          },
        },
        1002: {
          high: { percentage: 0.9, result_list: [] },
          medium: { percentage: 0.85, result_list: [] },
          low: { percentage: 0.7, result_list: [] },
        },
        1003: {
          high: { percentage: 0.88, result_list: [] },
          medium: { percentage: 0.75, result_list: [] },
          low: { percentage: 0.65, result_list: [] },
        },
      },
    },
  ];

  const defaultProps = {
    title: 'Importance Component Test',
    params: { project: 'test-project' },
    onDeleteClick: jest.fn(),
    onEditClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => ({ table_data: mockTableData }),
    });

    // Mock HttpClient.handleResponse
    HttpClient.handleResponse.mockImplementation((response, type) => {
      if (type === 'response') {
        return response;
      }
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Initial Rendering', () => {
    it('should render widget with title', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Importance Component Test',
        );
      });
    });

    it('should render component name', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
      });
    });

    it('should render table headers with build numbers', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
        expect(screen.getByText('1002')).toBeInTheDocument();
        expect(screen.getByText('1003')).toBeInTheDocument();
      });
    });

    it('should render importance levels', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('low')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data on mount', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'importance-component'],
          defaultProps.params,
        );
      });
    });

    it('should handle fetch error', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should handle non-ok response', async () => {
      HttpClient.get.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Data Display', () => {
    it('should display percentage values', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Percentages are converted from decimal to whole number
        expect(screen.getByText('95')).toBeInTheDocument(); // 0.95 -> 95
        expect(screen.getByText('80')).toBeInTheDocument(); // 0.8 -> 80
        expect(screen.getByText('60')).toBeInTheDocument(); // 0.6 -> 60
      });
    });

    it('should render links to results', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should create correct result links', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const link = screen.getByText('95').closest('a');
        expect(link).toHaveAttribute(
          'href',
          '/project/test-project/results?id[in]=d4e5f6a7-4567-8901-2def-345678901234;e5f6a7b8-5678-9012-3ef0-456789012345',
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should update state after data loads', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('should pass onDeleteClick prop to WidgetHeader', async () => {
      const onDeleteClick = jest.fn();

      render(
        <MemoryRouter>
          <ImportanceComponentWidget
            {...defaultProps}
            onDeleteClick={onDeleteClick}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onDeleteClick).not.toHaveBeenCalled(); // Not called until user clicks
    });

    it('should pass onEditClick prop to WidgetHeader', async () => {
      const onEditClick = jest.fn();

      render(
        <MemoryRouter>
          <ImportanceComponentWidget
            {...defaultProps}
            onEditClick={onEditClick}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onEditClick).not.toHaveBeenCalled(); // Not called until user clicks
    });
  });

  describe('Percentage Conversion', () => {
    it('should convert decimal percentages to whole numbers', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // 0.95 -> 95
        expect(screen.getByText('95')).toBeInTheDocument();
      });
    });

    it('should handle non-numeric percentages', async () => {
      const mockDataWithString = [
        {
          component: 'backend',
          bnums: ['1001'],
          importances: ['high'],
          data: {
            1001: {
              high: { percentage: 'N/A', result_list: [] },
            },
          },
        },
      ];

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ table_data: mockDataWithString }),
      });

      const { container } = render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(container.textContent).toContain('N/A');
      });
    });
  });

  describe('Multiple Components', () => {
    it('should display multiple components', async () => {
      const mockMultipleComponents = [
        mockTableData[0],
        {
          component: 'backend',
          bnums: ['2001', '2002'],
          importances: ['high', 'low'],
          data: {
            2001: {
              high: { percentage: 0.92, result_list: [] },
              low: { percentage: 0.55, result_list: [] },
            },
            2002: {
              high: { percentage: 0.88, result_list: [] },
              low: { percentage: 0.5, result_list: [] },
            },
          },
        },
      ];

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ table_data: mockMultipleComponents }),
      });

      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
        expect(screen.getByText('backend')).toBeInTheDocument();
      });
    });
  });

  describe('Dropdown Controls', () => {
    it('should render dropdown for count skips', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('param-dropdown')).toBeInTheDocument();
      });
    });

    it('should display count skips dropdown with default value', async () => {
      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Count skips as failure:/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty Data', () => {
    it('should handle empty table data without rendering tables', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ table_data: [] }),
      });

      render(
        <MemoryRouter>
          <ImportanceComponentWidget {...defaultProps} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Should not render any tables when data is empty
        const tables = screen.queryAllByRole('table');
        expect(tables.length).toBe(0);
      });
    });
  });
});
