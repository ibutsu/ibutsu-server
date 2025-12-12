import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeleteModal from './delete-modal';
import { HttpClient } from '../../utilities/http';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

describe('DeleteModal', () => {
  const mockOnDelete = jest.fn();
  const mockOnClose = jest.fn();

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
      onDelete: mockOnDelete,
      toDeleteId: '12345',
      toDeletePath: ['dashboard'],
      title: 'Delete Dashboard',
      body: 'Are you sure you want to delete this dashboard?',
    };

    return render(
      <MemoryRouter>
        <DeleteModal {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    HttpClient.delete.mockResolvedValue({ ok: true });
    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response;
      }
      throw new Error('Response not ok');
    });
  });

  describe('Modal rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderModal();

      expect(screen.getByText('Delete Dashboard')).toBeInTheDocument();
      expect(
        screen.getByText('Are you sure you want to delete this dashboard?'),
      ).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByText('Delete Dashboard')).not.toBeInTheDocument();
    });

    it('should render with custom title', () => {
      renderModal({ title: 'Delete Widget' });

      expect(screen.getByText('Delete Widget')).toBeInTheDocument();
    });

    it('should render with custom body text', () => {
      renderModal({ body: 'This action cannot be undone.' });

      expect(
        screen.getByText('This action cannot be undone.'),
      ).toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      renderModal();

      expect(
        screen.getByRole('button', { name: /delete/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Delete functionality', () => {
    it('should call HttpClient.delete with correct parameters', async () => {
      renderModal({
        toDeleteId: '123',
        toDeletePath: ['widget', 'config'],
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'widget',
          'config',
          '123',
        ]);
      });
    });

    it('should call onDelete callback after successful deletion', async () => {
      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalled();
      });
    });

    it('should call onClose after successful deletion', async () => {
      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should work without onDelete callback', async () => {
      renderModal({ onDelete: undefined });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalled();
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle delete with different resource paths', async () => {
      renderModal({
        toDeleteId: 'abc-123',
        toDeletePath: ['result'],
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'result',
          'abc-123',
        ]);
      });
    });
  });

  describe('Cancel functionality', () => {
    it('should call onClose when cancel button is clicked', () => {
      renderModal();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onDelete when cancel is clicked', () => {
      renderModal();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
      expect(HttpClient.delete).not.toHaveBeenCalled();
    });

    it('should call onClose when modal close is triggered', () => {
      renderModal();

      // Find the modal and trigger its onClose
      const modal = screen.getByTestId('delete-confirmation-modal');
      expect(modal).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle API errors and still close modal', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.delete.mockRejectedValue(new Error('API Error'));

      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      expect(mockOnClose).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle response errors', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.delete.mockResolvedValue({ ok: false });
      HttpClient.handleResponse.mockRejectedValue(new Error('Response not ok'));

      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      expect(mockOnClose).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Body content rendering', () => {
    it('should render body as React node', () => {
      renderModal({
        body: (
          <div>
            <p>First paragraph</p>
            <p>Second paragraph</p>
          </div>
        ),
      });

      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    });

    it('should render body as string', () => {
      renderModal({ body: 'Simple string body' });

      expect(screen.getByText('Simple string body')).toBeInTheDocument();
    });
  });

  describe('Button styling', () => {
    it('should render delete button with danger variant', () => {
      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should render cancel button with link variant', () => {
      renderModal();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle deleting a dashboard', async () => {
      renderModal({
        toDeleteId: 'dashboard-123',
        toDeletePath: ['dashboard'],
        title: 'Delete Dashboard',
        body: 'This will permanently delete the dashboard and all its widgets.',
      });

      expect(
        screen.getByText(
          'This will permanently delete the dashboard and all its widgets.',
        ),
      ).toBeInTheDocument();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'dashboard',
          'dashboard-123',
        ]);
      });

      expect(mockOnDelete).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle deleting a widget', async () => {
      renderModal({
        toDeleteId: 'widget-456',
        toDeletePath: ['widget', 'config'],
        title: 'Delete Widget',
        body: 'Are you sure you want to delete this widget?',
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'widget',
          'config',
          'widget-456',
        ]);
      });
    });

    it('should handle deleting a token', async () => {
      renderModal({
        toDeleteId: 'token-789',
        toDeletePath: ['user', 'token'],
        title: 'Delete Token',
        body: 'This will revoke the token immediately.',
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'user',
          'token',
          'token-789',
        ]);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible modal with proper OUIA ID', () => {
      renderModal();

      const modal = screen.getByTestId('delete-confirmation-modal');
      expect(modal).toBeInTheDocument();
    });

    it('should have accessible buttons with OUIA IDs', () => {
      renderModal();

      const deleteButton = screen.getByTestId('delete-confirm-button');
      const cancelButton = screen.getByTestId('delete-cancel-button');

      expect(deleteButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });

    it('should use default ouiaId when not provided', () => {
      renderModal();

      expect(
        screen.getByTestId('delete-confirmation-modal'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('delete-confirm-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-cancel-button')).toBeInTheDocument();
    });

    it('should accept custom ouiaId prop', () => {
      renderModal({ ouiaId: 'custom-delete-modal' });

      expect(screen.getByTestId('custom-delete-modal')).toBeInTheDocument();
    });
  });
});
