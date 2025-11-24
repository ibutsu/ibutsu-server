/* eslint-env jest */
import { HttpClient, buildUrl } from './http';
import { AuthService } from './auth';

// Mock AuthService
jest.mock('./auth', () => ({
  AuthService: {
    isLoggedIn: jest.fn(),
    getToken: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('HTTP Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AuthService.isLoggedIn.mockReturnValue(false);
    AuthService.getToken.mockReturnValue(null);
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
    });
  });

  describe('buildUrl', () => {
    it('should build URL without params', () => {
      const url = buildUrl('http://localhost/api', {});
      expect(url).toBe('http://localhost/api');
    });

    it('should build URL with single param', () => {
      const url = buildUrl('http://localhost/api', { key: 'value' });
      expect(url).toBe('http://localhost/api?key=value');
    });

    it('should build URL with multiple params', () => {
      const url = buildUrl('http://localhost/api', {
        key1: 'value1',
        key2: 'value2',
      });
      expect(url).toBe('http://localhost/api?key1=value1&key2=value2');
    });

    it('should handle array params', () => {
      const url = buildUrl('http://localhost/api', {
        filter: ['value1', 'value2', 'value3'],
      });
      expect(url).toBe(
        'http://localhost/api?filter=value1&filter=value2&filter=value3',
      );
    });

    it('should encode special characters', () => {
      const url = buildUrl('http://localhost/api', {
        query: 'test with spaces',
        special: 'test&value=123',
      });
      expect(url).toContain('test%20with%20spaces');
      expect(url).toContain('test%26value%3D123');
    });

    it('should handle mixed regular and array params', () => {
      const url = buildUrl('http://localhost/api', {
        single: 'value',
        array: ['item1', 'item2'],
      });
      expect(url).toContain('single=value');
      expect(url).toContain('array=item1');
      expect(url).toContain('array=item2');
    });

    it('should handle empty string values', () => {
      const url = buildUrl('http://localhost/api', { key: '' });
      expect(url).toBe('http://localhost/api?key=');
    });

    it('should handle numeric values', () => {
      const url = buildUrl('http://localhost/api', { page: 1, size: 50 });
      expect(url).toBe('http://localhost/api?page=1&size=50');
    });

    it('should handle boolean values', () => {
      const url = buildUrl('http://localhost/api', {
        active: true,
        deleted: false,
      });
      expect(url).toBe('http://localhost/api?active=true&deleted=false');
    });
  });

  describe('HttpClient.get', () => {
    it('should make GET request with URL string', async () => {
      await HttpClient.get('http://localhost/api/test');

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {});
    });

    it('should make GET request with URL array', async () => {
      await HttpClient.get(['http://localhost/api', 'test', 'resource']);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test/resource',
        {},
      );
    });

    it('should make GET request with params', async () => {
      await HttpClient.get('http://localhost/api/test', { key: 'value' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test?key=value',
        {},
      );
    });

    it('should add auth headers when logged in', async () => {
      AuthService.isLoggedIn.mockReturnValue(true);
      AuthService.getToken.mockReturnValue('test-token');

      await HttpClient.get('http://localhost/api/test');

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        headers: expect.any(Headers),
      });

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should handle URL array with leading/trailing slashes correctly', async () => {
      await HttpClient.get(['http://localhost/api/', '/test/', '/resource']);

      // The implementation normalizes slashes to prevent double slashes
      // Should result in 'http://localhost/api/test/resource' not 'http://localhost/api//test//resource'
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test/resource',
        {},
      );
    });

    it('should pass custom options', async () => {
      const options = { signal: new AbortController().signal };
      await HttpClient.get('http://localhost/api/test', {}, options);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        signal: expect.any(Object),
      });
    });
  });

  describe('HttpClient.post', () => {
    it('should make POST request with data', async () => {
      const data = { name: 'test', value: 123 };
      await HttpClient.post('http://localhost/api/test', data);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: expect.any(Headers),
      });

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should make POST request with URL array', async () => {
      await HttpClient.post(['http://localhost/api', 'test']);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: expect.any(Headers),
      });
    });

    it('should add auth headers when logged in', async () => {
      AuthService.isLoggedIn.mockReturnValue(true);
      AuthService.getToken.mockReturnValue('test-token');

      await HttpClient.post('http://localhost/api/test', { data: 'test' });

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Authorization')).toBe('Bearer test-token');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle empty data', async () => {
      await HttpClient.post('http://localhost/api/test');

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: expect.any(Headers),
      });
    });

    it('should merge custom headers', async () => {
      const customHeaders = new Headers({ 'X-Custom': 'value' });
      await HttpClient.post(
        'http://localhost/api/test',
        { data: 'test' },
        { headers: customHeaders },
      );

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('X-Custom')).toBe('value');
    });
  });

  describe('HttpClient.put', () => {
    it('should make PUT request with data', async () => {
      const data = { name: 'updated', value: 456 };
      await HttpClient.put('http://localhost/api/test', {}, data);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: expect.any(Headers),
      });
    });

    it('should make PUT request with params', async () => {
      const data = { name: 'updated' };
      await HttpClient.put('http://localhost/api/test', { id: '123' }, data);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test?id=123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      );
    });

    it('should add auth headers when logged in', async () => {
      AuthService.isLoggedIn.mockReturnValue(true);
      AuthService.getToken.mockReturnValue('test-token');

      await HttpClient.put('http://localhost/api/test', {}, { data: 'test' });

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should handle URL array', async () => {
      await HttpClient.put(['http://localhost/api', 'test', '123'], {}, {});

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test/123',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('HttpClient.delete', () => {
    it('should make DELETE request', async () => {
      await HttpClient.delete('http://localhost/api/test');

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test', {
        method: 'DELETE',
      });
    });

    it('should make DELETE request with params', async () => {
      await HttpClient.delete('http://localhost/api/test', { id: '123' });

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/test?id=123', {
        method: 'DELETE',
      });
    });

    it('should add auth headers when logged in', async () => {
      AuthService.isLoggedIn.mockReturnValue(true);
      AuthService.getToken.mockReturnValue('test-token');

      await HttpClient.delete('http://localhost/api/test');

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should handle URL array', async () => {
      await HttpClient.delete(['http://localhost/api', 'test', '123']);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test/123',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('HttpClient.upload', () => {
    it('should make upload request with files', async () => {
      const files = {
        file1: new File(['content'], 'test.txt', { type: 'text/plain' }),
      };

      await HttpClient.upload('http://localhost/api/upload', files);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/upload', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    it('should include params in FormData', async () => {
      const files = {
        file1: new File(['content'], 'test.txt', { type: 'text/plain' }),
      };
      const params = { project: 'test-project', env: 'staging' };

      await HttpClient.upload('http://localhost/api/upload', files, params);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/upload', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    it('should add auth headers when logged in', async () => {
      AuthService.isLoggedIn.mockReturnValue(true);
      AuthService.getToken.mockReturnValue('test-token');

      const files = {
        file1: new File(['content'], 'test.txt', { type: 'text/plain' }),
      };

      await HttpClient.upload('http://localhost/api/upload', files);

      const { headers } = fetch.mock.calls[0][1];
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should handle multiple files', async () => {
      const files = {
        file1: new File(['content1'], 'test1.txt', { type: 'text/plain' }),
        file2: new File(['content2'], 'test2.txt', { type: 'text/plain' }),
      };

      await HttpClient.upload('http://localhost/api/upload', files);

      expect(fetch).toHaveBeenCalledWith('http://localhost/api/upload', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });
  });

  describe('HttpClient.handleResponse', () => {
    it('should return JSON for successful response', async () => {
      const response = {
        ok: true,
        json: async () => ({ data: 'test' }),
      };

      const result = await HttpClient.handleResponse(response);
      expect(result).toEqual({ data: 'test' });
    });

    it('should return response object for non-JSON retType', async () => {
      const response = {
        ok: true,
        text: async () => 'plain text',
      };

      const result = await HttpClient.handleResponse(response, 'text');
      expect(result).toBe(response);
    });

    it('should redirect to login on 401', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      const response = {
        ok: false,
        status: 401,
      };

      HttpClient.handleResponse(response);
      expect(window.location).toBe('/login');

      window.location = originalLocation;
    });

    it('should not redirect for other error status codes', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      const response = {
        ok: false,
        status: 500,
      };

      HttpClient.handleResponse(response);
      expect(window.location).not.toBe('/login');

      window.location = originalLocation;
    });

    it('should handle response with ok false and no status', () => {
      const response = {
        ok: false,
      };

      const result = HttpClient.handleResponse(response);
      expect(result).toBeUndefined();
    });
  });
});
