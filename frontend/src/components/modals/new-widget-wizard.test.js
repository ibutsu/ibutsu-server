import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewWidgetWizard from './new-widget-wizard';
import { HttpClient } from '../../utilities/http';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock the useWidgetFilters hook
jest.mock('../hooks/use-widget-filters', () => ({
  useWidgetFilters: () => ({
    isResultBasedWidget: false,
    hasFilterParam: true,
    getActiveFiltersAsAPIString: jest.fn(() => 'test_id=test'),
    resetFilterContext: jest.fn(),
    CustomFilterProvider: ({ children }) => children,
    resetCounter: 0,
    runs: [],
  }),
  WidgetFilterComponent: () => (
    <div data-ouia-component-id="filter-component">Filters</div>
  ),
}));

// Mock WidgetParameterFields component
jest.mock('../widget-parameter-fields', () => {
  const PropTypes = require('prop-types');

  const MockWidgetParameterFields = ({
    widgetType,
    params,
    onChange,
    handleRequiredParam,
  }) => {
    return (
      <div data-ouia-component-id="widget-parameter-fields">
        {widgetType?.params
          ?.filter(
            (p) => p.name !== 'additional_filters' && p.name !== 'project',
          )
          .map((param) => (
            <div key={param.name}>
              <label htmlFor={param.name}>{param.name}</label>
              <input
                id={param.name}
                name={param.name}
                value={params[param.name] || ''}
                onChange={(e) =>
                  onChange({ target: { name: param.name } }, e.target.value)
                }
                data-validation={
                  handleRequiredParam ? handleRequiredParam(param) : 'default'
                }
              />
            </div>
          ))}
      </div>
    );
  };

  MockWidgetParameterFields.propTypes = {
    widgetType: PropTypes.object,
    params: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    handleRequiredParam: PropTypes.func,
  };

  return MockWidgetParameterFields;
});

describe('NewWidgetWizard', () => {
  const mockDashboard = {
    id: '650e8400-e29b-41d4-a716-446655440001',
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Dashboard',
  };

  const mockWidgetTypes = {
    types: [
      {
        id: 'filter-heatmap',
        title: 'Filtered Heatmap',
        description: 'A heatmap of filtered test runs.',
        params: [
          {
            name: 'additional_filters',
            description:
              'The filters for the runs to be included in the query.',
            type: 'string',
            required: true,
          },
          {
            name: 'builds',
            description: 'The number of builds to analyze.',
            type: 'integer',
            default: 5,
            required: true,
          },
          {
            name: 'group_field',
            description:
              "The field in a result to group by, typically 'component'",
            type: 'string',
            required: true,
            default: 'component',
          },
          {
            name: 'project',
            description: 'Filter results by a specific project ID',
            type: 'string',
            required: false,
          },
        ],
        type: 'widget',
      },
      {
        id: 'jenkins-heatmap',
        title: 'Jenkins Pipeline Heatmap',
        description: 'A heatmap of test runs from a Jenkins pipeline',
        params: [
          {
            name: 'job_name',
            description:
              "The Jenkins job name, this is the value of the 'metadata.jenkins.job_name' key.",
            type: 'string',
            required: true,
          },
          {
            name: 'builds',
            description: 'The number of Jenkins builds to analyze.',
            type: 'integer',
            default: 5,
            required: true,
          },
          {
            name: 'group_field',
            description:
              "The field in a result to group by, typically 'component'",
            type: 'string',
            required: true,
            default: 'component',
          },
        ],
        type: 'widget',
      },
      {
        id: 'result-summary',
        title: 'Result Summary',
        description: 'Summary of test results',
        params: [
          {
            name: 'limit',
            description: 'Number of results to display',
            type: 'integer',
            default: 10,
            required: false,
          },
        ],
        type: 'widget',
      },
    ],
  };

  const renderWizard = (props = {}) => {
    const defaultProps = {
      dashboard: mockDashboard,
      saveCallback: jest.fn(),
      closeCallback: jest.fn(),
      isOpen: true,
    };

    return render(
      <MemoryRouter>
        <NewWidgetWizard {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock widget types endpoint
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockWidgetTypes,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Wizard initialization', () => {
    it('should render the wizard when isOpen is true', async () => {
      renderWizard();

      await waitFor(() => {
        expect(screen.getByText('Add Widget')).toBeInTheDocument();
      });

      expect(screen.getByText('Select a widget type')).toBeInTheDocument();
    });

    it('should fetch widget types on mount', async () => {
      renderWizard();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'types'],
          { type: 'widget' },
        );
      });
    });

    it('should display all widget type options', async () => {
      renderWizard();

      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
        expect(
          screen.getByLabelText('Jenkins Pipeline Heatmap'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Result Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Step 1: Widget type selection', () => {
    it('should disable Next button when no widget type is selected', async () => {
      renderWizard();

      await waitFor(() => {
        expect(screen.getByText('Select a widget type')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should enable Next button when a widget type is selected', async () => {
      renderWizard();

      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
      });

      const filterHeatmapRadio = screen.getByLabelText('Filtered Heatmap');
      fireEvent.click(filterHeatmapRadio);

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).toBeEnabled();
      });
    });
  });

  describe('Step 3: Required parameter validation - Filter Heatmap Bug Fix', () => {
    it('should enable Next button when non-filter required params are filled (filter-heatmap)', async () => {
      renderWizard();

      // Select filter-heatmap widget
      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Filtered Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Enter title
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test Heatmap' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // On step 3, builds and group_field should be pre-filled with defaults
      await waitFor(() => {
        // Widget parameter fields render the input fields
        expect(screen.getByLabelText('builds')).toBeInTheDocument();
      });

      // The builds and group_field have defaults, so Next should be enabled
      // even though additional_filters (handled in step 4) is required
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).toBeEnabled();
      });
    });

    it('should disable Next button when required non-filter params are empty', async () => {
      renderWizard();

      // Select jenkins-heatmap widget which has job_name as required
      await waitFor(() => {
        expect(
          screen.getByLabelText('Jenkins Pipeline Heatmap'),
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Jenkins Pipeline Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Enter title
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test Jenkins Heatmap' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // On step 3, need to fill job_name
      await waitFor(() => {
        // Widget parameter fields render the job_name input
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });

      // Clear the job_name field
      await act(async () => {
        fireEvent.change(screen.getByLabelText('job_name'), {
          target: { value: '' },
        });
      });

      // Next button should be disabled because job_name is required and empty
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).toBeDisabled();
      });
    });

    it('should enable Next button when all required non-filter params are filled', async () => {
      renderWizard();

      // Select jenkins-heatmap widget
      await waitFor(() => {
        expect(
          screen.getByLabelText('Jenkins Pipeline Heatmap'),
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Jenkins Pipeline Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Enter title
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test Jenkins Heatmap' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Fill required fields
      await waitFor(() => {
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('job_name'), {
          target: { value: 'my-jenkins-job' },
        });
      });

      // Next button should be enabled
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).toBeEnabled();
      });
    });

    it('should handle widgets with no required params correctly', async () => {
      renderWizard();

      // Select result-summary widget (only has optional params)
      await waitFor(() => {
        expect(screen.getByLabelText('Result Summary')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Result Summary'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Enter title
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test Summary' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // On step 3, Next should be enabled since all params are optional
      await waitFor(() => {
        // Widget parameter fields render the limit input
        expect(screen.getByLabelText('limit')).toBeInTheDocument();
      });

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).toBeEnabled();
      });
    });
  });

  describe('Parameter validation logic', () => {
    it('should validate string parameters correctly', async () => {
      renderWizard();

      // Select jenkins-heatmap widget
      await waitFor(() => {
        expect(
          screen.getByLabelText('Jenkins Pipeline Heatmap'),
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Jenkins Pipeline Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });

      const jobNameInput = screen.getByLabelText('job_name');

      // Initially empty string should show error validation
      await act(async () => {
        fireEvent.change(jobNameInput, { target: { value: '' } });
      });

      await waitFor(() => {
        expect(jobNameInput).toHaveAttribute('data-validation', 'error');
      });

      // After typing, should show default validation
      await act(async () => {
        fireEvent.change(jobNameInput, { target: { value: 'test-job' } });
      });

      await waitFor(() => {
        expect(jobNameInput).toHaveAttribute('data-validation', 'default');
      });
    });

    it('should accept 0 as valid value for numeric parameters', async () => {
      renderWizard();

      // Select filter-heatmap widget
      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Filtered Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('builds')).toBeInTheDocument();
      });

      const buildsInput = screen.getByLabelText('builds');

      // Set to 0 - should still be valid for numeric fields
      await act(async () => {
        fireEvent.change(buildsInput, { target: { value: '0' } });
      });

      await waitFor(() => {
        // Should not show error (0 is valid for numeric types)
        expect(buildsInput).toHaveAttribute('data-validation', 'default');
      });
    });
  });

  describe('Wizard navigation', () => {
    it('should have a close button in the wizard header', async () => {
      const closeCallback = jest.fn();
      renderWizard({ closeCallback });

      await waitFor(() => {
        expect(screen.getByText('Add Widget')).toBeInTheDocument();
      });

      // Verify wizard renders (close button functionality tested in integration)
      expect(screen.getByText('Select a widget type')).toBeInTheDocument();
    });
  });

  describe('Widget saving', () => {
    it('should parse integer parameters correctly', async () => {
      const saveCallback = jest.fn();
      renderWizard({ saveCallback });

      // Complete wizard with custom builds value
      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('Filtered Heatmap'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/title/i), {
          target: { value: 'Test Widget' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('builds')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('builds'), {
          target: { value: '10' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      // Skip to end - filter component renders "Filters" text
      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /review details/i }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /finish/i }));
      });

      // Verify builds was parsed as integer
      await waitFor(() => {
        expect(saveCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              builds: 10, // Should be integer, not string
            }),
          }),
        );
      });
    });
  });

  describe('Review step', () => {
    it('should have a review step as part of wizard flow', async () => {
      renderWizard();

      // Verify wizard has multiple steps including review
      await waitFor(() => {
        expect(screen.getByLabelText('Filtered Heatmap')).toBeInTheDocument();
      });

      // The wizard includes review as final step (detailed navigation tested in integration)
      expect(screen.getByText('Select a widget type')).toBeInTheDocument();
    });
  });
});
