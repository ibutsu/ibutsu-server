import { AuthService } from './auth';

// Mock Settings
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('Auth Utilities', () => {
  let mockLocalStorage;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset AuthService errors
    AuthService.loginError = null;
    AuthService.registerError = null;
    AuthService.recoverError = null;
    AuthService._cachedUser = null;
    AuthService._tokenValidated = false;

    // Mock localStorage
    mockLocalStorage = {};
    Storage.prototype.getItem = jest.fn((key) => mockLocalStorage[key] || null);
    Storage.prototype.setItem = jest.fn((key, value) => {
      mockLocalStorage[key] = value;
    });
    Storage.prototype.removeItem = jest.fn((key) => {
      delete mockLocalStorage[key];
    });

    // Default fetch mock
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });

  describe('getLocalUser', () => {
    it('should return null when no user in localStorage', () => {
      expect(AuthService.getLocalUser()).toBeNull();
    });

    it('should return parsed user from localStorage', () => {
      const user = { id: '123', email: 'test@example.com', token: 'abc' };
      mockLocalStorage.user = JSON.stringify(user);

      expect(AuthService.getLocalUser()).toEqual(user);
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.user = 'invalid-json';

      expect(() => AuthService.getLocalUser()).toThrow();
    });
  });

  describe('setUser', () => {
    it('should store user in localStorage', () => {
      const user = { id: '123', email: 'test@example.com', token: 'abc' };

      AuthService.setUser(user);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(user),
      );
    });

    it('should store user object with all properties', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        token: 'abc',
        is_superadmin: true,
      };

      AuthService.setUser(user);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(user),
      );
    });
  });

  describe('getToken', () => {
    it('should return null when no user', async () => {
      expect(await AuthService.getToken()).toBeNull();
    });

    it('should return null when user has no token', async () => {
      mockLocalStorage.user = JSON.stringify({ email: 'test@example.com' });

      expect(await AuthService.getToken()).toBeNull();
    });

    it('should return token from user', async () => {
      const user = { email: 'test@example.com', token: 'test-token-123' };
      mockLocalStorage.user = JSON.stringify(user);

      expect(await AuthService.getToken()).toBe('test-token-123');
    });
  });

  describe('setToken', () => {
    it('should set token for existing user', () => {
      const existingUser = { email: 'test@example.com' };
      mockLocalStorage.user = JSON.stringify(existingUser);

      AuthService.setToken('new-token');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ email: 'test@example.com', token: 'new-token' }),
      );
    });

    it('should create user object when no user exists', () => {
      AuthService.setToken('new-token');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ token: 'new-token' }),
      );
    });

    it('should update token for existing user with token', () => {
      const existingUser = { email: 'test@example.com', token: 'old-token' };
      mockLocalStorage.user = JSON.stringify(existingUser);

      AuthService.setToken('new-token');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ email: 'test@example.com', token: 'new-token' }),
      );
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when no token', async () => {
      expect(await AuthService.isLoggedIn()).toBe(false);
    });

    it('should return true when token exists', async () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      expect(await AuthService.isLoggedIn()).toBe(true);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const userData = {
        id: '123',
        email: 'test@example.com',
        token: 'jwt-token-123',
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => userData,
      });

      const result = await AuthService.login('test@example.com', 'password');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(userData),
      );
    });

    it('should handle login failure with error code', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 401, message: 'Invalid credentials' }),
      });

      const result = await AuthService.login('test@example.com', 'wrong');

      expect(result).toBe(false);
      expect(AuthService.loginError).toEqual({
        code: 401,
        message: 'Invalid credentials',
      });
    });

    it('should handle login with no token in response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Some other response' }),
      });

      const result = await AuthService.login('test@example.com', 'password');

      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Registration successful' }),
      });

      const result = await AuthService.register('new@example.com', 'password');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/login/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email: 'new@example.com',
            password: 'password',
          }),
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        },
      );
    });

    it('should handle registration error', async () => {
      const error = new Error('Network error');
      global.fetch.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await AuthService.register('new@example.com', 'password');

      expect(result).toBe(false);
      expect(AuthService.registerError).toBe(error);
      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });

  describe('recover', () => {
    it('should recover account successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
      });

      const result = await AuthService.recover('test@example.com');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/login/recover',
        {
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        },
      );
    });

    it('should handle recovery failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      const result = await AuthService.recover('test@example.com');

      expect(result).toBe(false);
      expect(AuthService.recoverError).toEqual({
        message: 'There was a problem recovering your account',
      });
    });

    it('should handle network error during recovery', async () => {
      const error = new Error('Network error');
      global.fetch.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await AuthService.recover('test@example.com');

      expect(result).toBe(false);
      expect(AuthService.recoverError).toBe(error);
      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
      });

      const result = await AuthService.resetPassword(
        'activation123',
        'newpass',
      );

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/login/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            activation_code: 'activation123',
            password: 'newpass',
          }),
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        },
      );
    });

    it('should handle invalid activation code', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      const result = await AuthService.resetPassword('invalid', 'newpass');

      expect(result).toBe(false);
      expect(AuthService.resetError).toEqual({
        message: 'Invalid activation code or password',
      });
    });

    it('should handle network error during password reset', async () => {
      const error = new Error('Network error');
      global.fetch.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await AuthService.resetPassword(
        'activation123',
        'newpass',
      );

      expect(result).toBe(false);
      expect(AuthService.resetError).toBe(error);
      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('should remove user from localStorage', () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      AuthService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('isSuperAdmin', () => {
    it('should return false when no user', async () => {
      const result = await AuthService.isSuperAdmin();

      expect(result).toBe(false);
    });

    it('should return true when user is superadmin', async () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ is_superadmin: true }),
      });

      const result = await AuthService.isSuperAdmin();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/user', {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should return false when user is not superadmin', async () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ is_superadmin: false }),
      });

      const result = await AuthService.isSuperAdmin();

      expect(result).toBe(false);
    });

    it('should handle fetch error', async () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      global.fetch.mockResolvedValue({
        ok: false,
        message: 'Unauthorized',
      });

      const result = await AuthService.isSuperAdmin();

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      mockLocalStorage.user = JSON.stringify({ token: 'test-token' });

      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await AuthService.isSuperAdmin();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
