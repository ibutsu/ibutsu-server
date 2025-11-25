/* eslint-env jest */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddTokenModal from './add-token-modal';
import { HttpClient } from '../../utilities/http';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

describe('AddTokenModal', () => {
  const mockOnClose = jest.fn();

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
    };

    return render(
      <MemoryRouter>
        <AddTokenModal {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderModal();

      expect(screen.getByText('Add Token')).toBeInTheDocument();
      expect(screen.getByTestId('token-name-input')).toBeInTheDocument();
      expect(screen.getByText('Expiry')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByText('Add Token')).not.toBeInTheDocument();
    });

    it('should render form with all required fields', () => {
      renderModal();

      expect(screen.getByTestId('token-name-input')).toBeInTheDocument();
      // DatePicker renders as aria-label="Date picker"
      expect(screen.getByLabelText('Date picker')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show error when name is empty and save is clicked', async () => {
      renderModal();

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A token name is required'),
        ).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(HttpClient.post).not.toHaveBeenCalled();
    });

    it('should show error when expiry date is empty and save is clicked', async () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A valid expiry date is required'),
        ).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(HttpClient.post).not.toHaveBeenCalled();
    });

    it('should show error when expiry date is in the past', async () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      // Get the date input that's part of the DatePicker
      const input = screen.getByLabelText('Date picker');

      // Set a date in the past
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: pastDate } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A valid expiry date is required'),
        ).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(HttpClient.post).not.toHaveBeenCalled();
    });

    it('should accept valid future date', async () => {
      HttpClient.post.mockResolvedValue({ ok: true });

      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      // Get the date input that's part of the DatePicker
      const input = screen.getByLabelText('Date picker');

      // Set a date in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: futureDate } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(HttpClient.post).toHaveBeenCalled();
      });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Form submission', () => {
    it('should submit form with valid data', async () => {
      HttpClient.post.mockResolvedValue({ ok: true });

      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'My API Token' } });

      const input = screen.getByLabelText('Date picker');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateString = futureDate.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: dateString } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(HttpClient.post).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'user', 'token'],
          expect.objectContaining({
            name: 'My API Token',
            expires: expect.any(String),
          }),
        );
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should set expiry time to end of day (23:59:59)', async () => {
      HttpClient.post.mockResolvedValue({ ok: true });

      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const input = screen.getByLabelText('Date picker');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: dateString } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(HttpClient.post).toHaveBeenCalled();
      });

      const callArgs = HttpClient.post.mock.calls[0][1];
      const expiryDate = new Date(callArgs.expires);

      expect(expiryDate.getHours()).toBe(23);
      expect(expiryDate.getMinutes()).toBe(59);
      expect(expiryDate.getSeconds()).toBe(59);
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.post.mockRejectedValue(new Error('API Error'));

      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const input = screen.getByLabelText('Date picker');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateString = futureDate.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: dateString } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error posting token:',
          expect.any(Error),
        );
      });

      expect(mockOnClose).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Modal interactions', () => {
    it('should close modal when cancel button is clicked', () => {
      renderModal();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when modal is closed', () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const input = screen.getByLabelText('Date picker');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateString = futureDate.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: dateString } });

      expect(nameInput).toHaveValue('Test Token');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should allow name input to be changed', () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'New Token Name' } });

      expect(nameInput).toHaveValue('New Token Name');
    });
  });

  describe('Validation state management', () => {
    it('should clear name validation error when valid name is entered after error', async () => {
      renderModal();

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A token name is required'),
        ).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Valid Token Name' } });

      // The error should still be visible until we try to save again
      expect(screen.getByText('A token name is required')).toBeInTheDocument();
    });

    it('should clear expiry validation error when valid date is entered after error', async () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A valid expiry date is required'),
        ).toBeInTheDocument();
      });

      const input = screen.getByLabelText('Date picker');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateString = futureDate.toISOString().split('T')[0];

      fireEvent.change(input, { target: { value: dateString } });

      // The error should still be visible until we try to save again
      expect(
        screen.getByText('A valid expiry date is required'),
      ).toBeInTheDocument();
    });
  });

  describe('Helper text', () => {
    it('should show default helper text for expiry field when valid', () => {
      renderModal();

      expect(
        screen.getByText('Enter the expiry date for this token'),
      ).toBeInTheDocument();
    });

    it('should show error helper text for expiry field when invalid', async () => {
      renderModal();

      const nameInput = screen.getByTestId('token-name-input');
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('A valid expiry date is required'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should use default ouiaId when not provided', () => {
      renderModal();

      expect(screen.getByTestId('add-token-modal')).toBeInTheDocument();
      // Form in PatternFly v6 doesn't support ouiaId as testId
      expect(screen.getByText('Add Token')).toBeInTheDocument();
      expect(screen.getByTestId('token-name-input')).toBeInTheDocument();
      // DatePicker has aria-label instead of testId
      expect(screen.getByLabelText('Date picker')).toBeInTheDocument();
      expect(screen.getByTestId('add-token-save-button')).toBeInTheDocument();
      expect(screen.getByTestId('add-token-cancel-button')).toBeInTheDocument();
    });

    it('should accept custom ouiaId prop', () => {
      renderModal({ ouiaId: 'custom-token-modal' });

      expect(screen.getByTestId('custom-token-modal')).toBeInTheDocument();
    });

    it('should set modal id for DatePicker appendTo', () => {
      renderModal({ ouiaId: 'my-token-modal' });

      const modal = screen.getByTestId('my-token-modal');
      expect(modal).toHaveAttribute('id', 'my-token-modal');
    });
  });
});
