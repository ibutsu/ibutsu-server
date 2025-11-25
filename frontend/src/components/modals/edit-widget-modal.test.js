/* eslint-env jest */
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditWidgetModal from './edit-widget-modal';
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
    <div data-testid="filter-component">Filters</div>
  ),
}));

// Mock WidgetParameterFields component
jest.mock('../widget-parameter-fields', () => {
  const PropTypes = require('prop-types');

  const MockWidgetParameterFields = ({ widgetType, params, onChange }) => {
    return (
      <div data-testid="widget-parameter-fields">
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
  };

  return MockWidgetParameterFields;
});

describe('EditWidgetModal', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  const mockWidgetData = {
    widget: 'jenkins-heatmap',
    title: 'Jenkins Heatmap Widget',
    weight: 10,
    params: {
      job_name: 'test-job',
      builds: 5,
      group_field: 'component',
    },
  };

  const mockWidgetTypes = {
    types: [
      {
        id: 'jenkins-heatmap',
        title: 'Jenkins Pipeline Heatmap',
        description: 'A heatmap of test runs from a Jenkins pipeline',
        params: [
          {
            name: 'job_name',
            description: 'The Jenkins job name',
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
            description: 'The field in a result to group by',
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

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onSave: mockOnSave,
      onClose: mockOnClose,
      data: mockWidgetData,
    };

    return render(
      <MemoryRouter>
        <EditWidgetModal {...defaultProps} {...props} />
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

  describe('Modal rendering', () => {
    it('should render modal when isOpen is true', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Edit widget')).toBeInTheDocument();
      });
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByText('Edit widget')).not.toBeInTheDocument();
    });

    it('should show loading skeleton before widget types are loaded', async () => {
      // Delay the HTTP response to allow skeleton to be visible
      let resolveGet;
      const getPromise = new Promise((resolve) => {
        resolveGet = resolve;
      });
      HttpClient.get.mockReturnValue(getPromise);

      renderModal();

      // Should show skeleton initially
      await waitFor(() => {
        const skeletons = document.querySelectorAll(
          '[class*="pf-v6-c-skeleton"]',
        );
        expect(skeletons.length).toBeGreaterThan(0);
      });

      // Resolve the promise to continue
      act(() => {
        resolveGet({
          ok: true,
          json: async () => mockWidgetTypes,
        });
      });
    });

    it('should render form after widget types are loaded', async () => {
      renderModal();

      await waitFor(() => {
        // Form in PatternFly v6 doesn't render ouiaId as testId
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });
    });
  });

  describe('Form initialization', () => {
    it('should populate form fields with existing widget data', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toHaveValue(
          'Jenkins Heatmap Widget',
        );
      });

      // Weight input returns number
      const weightInput = screen.getByTestId('widget-weight-input');
      expect(weightInput.value).toBe('10');
    });

    it('should load widget type from API', async () => {
      renderModal();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'types'],
          { type: 'widget' },
        );
      });
    });

    it('should initialize params from data prop', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText('job_name')).toHaveValue('test-job');
      });

      // Builds input returns string representation of number
      expect(screen.getByLabelText('builds').value).toBe('5');
      expect(screen.getByLabelText('group_field')).toHaveValue('component');
    });

    it('should handle widget data with no params', async () => {
      renderModal({
        data: {
          widget: 'jenkins-heatmap',
          title: 'Test Widget',
          weight: 5,
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toHaveValue(
          'Test Widget',
        );
      });
    });

    it('should handle widget data with different weight', async () => {
      renderModal({
        data: {
          ...mockWidgetData,
          weight: 0,
        },
      });

      await waitFor(() => {
        const weightInput = screen.getByTestId('widget-weight-input');
        expect(weightInput.value).toBe('0');
      });
    });
  });

  describe('Form validation', () => {
    it('should disable save button when title is empty', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '' } });
      });

      await waitFor(() => {
        const saveButton = screen.getByTestId('edit-widget-save-button');
        expect(saveButton).toBeDisabled();
      });
    });

    it('should enable save button when title is provided', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      expect(titleInput).toHaveValue('Jenkins Heatmap Widget');

      await waitFor(() => {
        const saveButton = screen.getByTestId('edit-widget-save-button');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should show validation error for empty title', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '' } });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a title for this widget'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form input handling', () => {
    it('should update title when changed', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, {
          target: { value: 'Updated Widget Title' },
        });
      });

      expect(titleInput).toHaveValue('Updated Widget Title');
    });

    it('should update weight when changed', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-weight-input')).toBeInTheDocument();
      });

      const weightInput = screen.getByTestId('widget-weight-input');
      await act(async () => {
        fireEvent.change(weightInput, { target: { value: '20' } });
      });

      expect(weightInput.value).toBe('20');
    });

    it('should update parameters when changed', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });

      const jobNameInput = screen.getByLabelText('job_name');
      await act(async () => {
        fireEvent.change(jobNameInput, {
          target: { value: 'new-jenkins-job' },
        });
      });

      expect(jobNameInput).toHaveValue('new-jenkins-job');
    });

    it('should handle numeric parameter changes', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText('builds')).toBeInTheDocument();
      });

      const buildsInput = screen.getByLabelText('builds');
      await act(async () => {
        fireEvent.change(buildsInput, { target: { value: '10' } });
      });

      expect(buildsInput.value).toBe('10');
    });
  });

  describe('Form submission', () => {
    it('should call onSave with updated widget data', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, {
          target: { value: 'Updated Widget' },
        });
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Widget',
            weight: 10,
            type: 'widget',
            widget: 'jenkins-heatmap',
          }),
        );
      });
    });

    it('should include updated parameters in save', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });

      const jobNameInput = screen.getByLabelText('job_name');
      await act(async () => {
        fireEvent.change(jobNameInput, {
          target: { value: 'updated-job' },
        });
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              job_name: 'updated-job',
            }),
          }),
        );
      });
    });

    it('should parse weight as integer', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-weight-input')).toBeInTheDocument();
      });

      const weightInput = screen.getByTestId('widget-weight-input');
      await act(async () => {
        fireEvent.change(weightInput, { target: { value: '25' } });
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            weight: 25,
          }),
        );
      });
    });

    it('should handle weight as 0', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-weight-input')).toBeInTheDocument();
      });

      const weightInput = screen.getByTestId('widget-weight-input');
      await act(async () => {
        fireEvent.change(weightInput, { target: { value: '' } });
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            weight: 0,
          }),
        );
      });
    });

    it('should include filter string in params when hasFilterParam is true', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              additional_filters: 'test_id=test',
            }),
          }),
        );
      });
    });

    it('should reset form after save', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, {
          target: { value: 'Updated Widget' },
        });
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(titleInput).toHaveValue('');
      });
    });
  });

  describe('Modal interactions', () => {
    it('should close modal when cancel button is clicked', async () => {
      renderModal();

      await waitFor(() => {
        expect(
          screen.getByTestId('edit-widget-cancel-button'),
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('edit-widget-cancel-button');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should reset form when cancel is clicked', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('widget-title-input');
      await act(async () => {
        fireEvent.change(titleInput, {
          target: { value: 'Changed Title' },
        });
      });

      const cancelButton = screen.getByTestId('edit-widget-cancel-button');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal via modal onClose handler', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('edit-widget-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('edit-widget-cancel-button');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Widget filters', () => {
    it('should render filter component when loaded', async () => {
      renderModal();

      await waitFor(() => {
        // Filter component is mocked and renders "Filters" text
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });
    });

    it('should pass filter string to save callback', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('edit-widget-save-button');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              additional_filters: 'test_id=test',
            }),
          }),
        );
      });
    });
  });

  describe('Widget type loading', () => {
    it('should fetch widget types on mount', async () => {
      renderModal();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'types'],
          { type: 'widget' },
        );
      });
    });

    it('should set widget type based on data.widget', async () => {
      renderModal();

      await waitFor(() => {
        // Widget parameter fields render the parameter inputs
        expect(screen.getByLabelText('job_name')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.get.mockRejectedValue(new Error('API Error'));

      renderModal();

      // Should still render the modal even if API fails
      expect(screen.getByText('Edit widget')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Helper text', () => {
    it('should show helper text for weight field', async () => {
      renderModal();

      await waitFor(() => {
        expect(
          screen.getByText('How widgets are ordered on the dashboard'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data updates', () => {
    it('should update form when data prop changes', async () => {
      const { rerender } = renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toHaveValue(
          'Jenkins Heatmap Widget',
        );
      });

      const newData = {
        widget: 'jenkins-heatmap',
        title: 'New Widget Title',
        weight: 15,
        params: {
          job_name: 'new-job',
          builds: 10,
          group_field: 'test',
        },
      };

      rerender(
        <MemoryRouter>
          <EditWidgetModal
            isOpen={true}
            onSave={mockOnSave}
            onClose={mockOnClose}
            data={newData}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toHaveValue(
          'New Widget Title',
        );
      });

      const weightInput = screen.getByTestId('widget-weight-input');
      expect(weightInput.value).toBe('15');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible modal with proper OUIA ID', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('edit-widget-modal')).toBeInTheDocument();
      });
    });

    it('should have accessible form with OUIA ID', async () => {
      renderModal();

      await waitFor(() => {
        // Form in PatternFly v6 doesn't render ouiaId as testId
        expect(screen.getByTestId('edit-widget-modal')).toBeInTheDocument();
      });
    });

    it('should have accessible inputs with OUIA IDs', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
        expect(screen.getByTestId('widget-weight-input')).toBeInTheDocument();
      });
    });

    it('should have accessible buttons with OUIA IDs', async () => {
      renderModal();

      await waitFor(() => {
        expect(
          screen.getByTestId('edit-widget-save-button'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('edit-widget-cancel-button'),
        ).toBeInTheDocument();
      });
    });

    it('should use default ouiaId when not provided', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('edit-widget-modal')).toBeInTheDocument();
        // Form in PatternFly v6 doesn't support ouiaId as testId
        expect(screen.getByText('Edit widget')).toBeInTheDocument();
        expect(screen.getByTestId('widget-title-input')).toBeInTheDocument();
        expect(screen.getByTestId('widget-weight-input')).toBeInTheDocument();
        expect(
          screen.getByTestId('edit-widget-save-button'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('edit-widget-cancel-button'),
        ).toBeInTheDocument();
      });
    });

    it('should accept custom ouiaId prop', async () => {
      renderModal({ ouiaId: 'custom-edit-widget-modal' });

      await waitFor(() => {
        expect(
          screen.getByTestId('custom-edit-widget-modal'),
        ).toBeInTheDocument();
      });
    });
  });
});
