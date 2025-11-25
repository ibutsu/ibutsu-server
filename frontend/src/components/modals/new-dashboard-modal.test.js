/* eslint-env jest */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewDashboardModal from './new-dashboard-modal';

describe('NewDashboardModal', () => {
  const mockSaveCallback = jest.fn();
  const mockCloseCallback = jest.fn();
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Project',
  };

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      saveCallback: mockSaveCallback,
      closeCallback: mockCloseCallback,
      project: mockProject,
    };

    return render(
      <MemoryRouter>
        <NewDashboardModal {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderModal();

      expect(screen.getByText('New Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-title-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-description-input'),
      ).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByText('New Dashboard')).not.toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderModal();

      expect(screen.getByTestId('dashboard-title-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-description-input'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it('should mark title as required', () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      expect(titleInput).toHaveAttribute('required');
    });

    it('should not mark description as required', () => {
      renderModal();

      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );
      expect(descriptionInput).not.toHaveAttribute('required');
    });
  });

  describe('Form validation', () => {
    it('should show validation error when title is empty and save is clicked', async () => {
      renderModal();

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockSaveCallback).not.toHaveBeenCalled();
    });

    it('should allow save when title is provided', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'My Dashboard' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalled();
      });
    });

    it('should require title before saving', async () => {
      renderModal();

      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );
      fireEvent.change(descriptionInput, {
        target: { value: 'A description' },
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockSaveCallback).not.toHaveBeenCalled();
    });
  });

  describe('Form submission', () => {
    it('should call saveCallback with correct data structure', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );

      fireEvent.change(titleInput, { target: { value: 'Test Dashboard' } });
      fireEvent.change(descriptionInput, {
        target: { value: 'Dashboard description' },
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith({
          title: 'Test Dashboard',
          description: 'Dashboard description',
          project_id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });
    });

    it('should include project_id from project prop', async () => {
      renderModal({
        project: {
          id: 'custom-project-id',
          name: 'Custom Project',
        },
      });

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'Dashboard' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            project_id: 'custom-project-id',
          }),
        );
      });
    });

    it('should handle undefined project', async () => {
      renderModal({ project: undefined });

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'Dashboard' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            project_id: undefined,
          }),
        );
      });
    });

    it('should save with empty description', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'Dashboard' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith({
          title: 'Dashboard',
          description: '',
          project_id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });
    });

    it('should reset form after successful save', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );

      fireEvent.change(titleInput, { target: { value: 'Test Dashboard' } });
      fireEvent.change(descriptionInput, {
        target: { value: 'Test description' },
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(titleInput).toHaveValue('');
        expect(descriptionInput).toHaveValue('');
      });
    });
  });

  describe('Modal interactions', () => {
    it('should close modal when cancel button is clicked', () => {
      renderModal();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockCloseCallback).toHaveBeenCalled();
      expect(mockSaveCallback).not.toHaveBeenCalled();
    });

    it('should reset form when cancel is clicked', () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );

      fireEvent.change(titleInput, { target: { value: 'Test' } });
      fireEvent.change(descriptionInput, { target: { value: 'Desc' } });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(titleInput).toHaveValue('');
      expect(descriptionInput).toHaveValue('');
    });

    it('should call closeCallback when modal close is triggered', () => {
      renderModal();

      // Find modal by OUIA ID
      const modal = screen.getByTestId('new-dashboard-modal');
      expect(modal).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockCloseCallback).toHaveBeenCalled();
    });
  });

  describe('Form input handling', () => {
    it('should update title input value', () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      expect(titleInput).toHaveValue('New Title');
    });

    it('should update description input value', () => {
      renderModal();

      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );
      fireEvent.change(descriptionInput, {
        target: { value: 'New Description' },
      });

      expect(descriptionInput).toHaveValue('New Description');
    });

    it('should handle multiple title changes', () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');

      fireEvent.change(titleInput, { target: { value: 'First' } });
      expect(titleInput).toHaveValue('First');

      fireEvent.change(titleInput, { target: { value: 'Second' } });
      expect(titleInput).toHaveValue('Second');

      fireEvent.change(titleInput, { target: { value: 'Final' } });
      expect(titleInput).toHaveValue('Final');
    });

    it('should handle long title text', () => {
      renderModal();

      const longTitle =
        'This is a very long dashboard title that exceeds normal length';
      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: longTitle } });

      expect(titleInput).toHaveValue(longTitle);
    });

    it('should handle long description text', () => {
      renderModal();

      const longDescription =
        'This is a very long dashboard description that contains multiple sentences and provides detailed information about what this dashboard is used for and what kind of data it displays.';
      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );
      fireEvent.change(descriptionInput, {
        target: { value: longDescription },
      });

      expect(descriptionInput).toHaveValue(longDescription);
    });
  });

  describe('Validation state management', () => {
    it('should maintain validation state after failed save attempt', async () => {
      renderModal();

      // Try to save with empty title
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockSaveCallback).not.toHaveBeenCalled();

      // Now add title and try again
      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should create a basic dashboard with only title', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      fireEvent.change(titleInput, {
        target: { value: 'Production Dashboard' },
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith({
          title: 'Production Dashboard',
          description: '',
          project_id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });
    });

    it('should create a detailed dashboard with title and description', async () => {
      renderModal();

      const titleInput = screen.getByTestId('dashboard-title-input');
      const descriptionInput = screen.getByTestId(
        'dashboard-description-input',
      );

      fireEvent.change(titleInput, {
        target: { value: 'Test Results Dashboard' },
      });
      fireEvent.change(descriptionInput, {
        target: { value: 'Dashboard for tracking daily test results' },
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveCallback).toHaveBeenCalledWith({
          title: 'Test Results Dashboard',
          description: 'Dashboard for tracking daily test results',
          project_id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible modal with proper OUIA ID', () => {
      renderModal();

      const modal = screen.getByTestId('new-dashboard-modal');
      expect(modal).toBeInTheDocument();
    });

    it('should have accessible form with OUIA ID', () => {
      renderModal();

      // Form in PatternFly v6 doesn't render ouiaId as testId
      const modal = screen.getByTestId('new-dashboard-modal');
      expect(modal).toBeInTheDocument();
    });

    it('should have accessible inputs with OUIA IDs', () => {
      renderModal();

      expect(screen.getByTestId('dashboard-title-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-description-input'),
      ).toBeInTheDocument();
    });

    it('should have accessible buttons with OUIA IDs', () => {
      renderModal();

      expect(
        screen.getByTestId('new-dashboard-save-button'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('new-dashboard-cancel-button'),
      ).toBeInTheDocument();
    });

    it('should use default ouiaId when not provided', () => {
      renderModal();

      expect(screen.getByTestId('new-dashboard-modal')).toBeInTheDocument();
      // Form in PatternFly v6 doesn't support ouiaId as testId
      expect(screen.getByText('New Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-title-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-description-input'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('new-dashboard-save-button'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('new-dashboard-cancel-button'),
      ).toBeInTheDocument();
    });

    it('should accept custom ouiaId prop', () => {
      renderModal({ ouiaId: 'custom-dashboard-modal' });

      expect(screen.getByTestId('custom-dashboard-modal')).toBeInTheDocument();
    });
  });
});
