import { AuthService } from './auth';

const trim = (string) => {
  if (string.startsWith('/')) {
    string = string.slice(1);
  }
  if (string.endsWith('/')) {
    string = string.slice(0, -1);
  }
  return string;
};

const prepareUrl = (url, params = {}) => {
  let newUrl = url;
  if (url instanceof Array) {
    newUrl = url[0];
    // Trim trailing slash from first segment to avoid double slashes
    if (newUrl.endsWith('/')) {
      newUrl = newUrl.slice(0, -1);
    }
    url.slice(1).forEach((fragment) => {
      newUrl = [newUrl, trim(fragment)].join('/');
    });
  }
  return buildUrl(newUrl, params);
};

const addAuth = async (options) => {
  if (await AuthService.isLoggedIn()) {
    const bearer = 'Bearer ' + (await AuthService.getToken());
    if (Object.keys(options).includes('headers')) {
      options['headers'].set('Authorization', bearer);
    } else {
      options['headers'] = new Headers({ Authorization: bearer });
    }
  }
  return options;
};

export const buildUrl = (url, params) => {
  // shorthand
  const esc = encodeURIComponent;
  let query = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value instanceof Array) {
      value.forEach((element) => {
        query.push(esc(key) + '=' + esc(element));
      });
    } else {
      query.push(esc(key) + '=' + esc(value));
    }
  }
  if (query.length > 0) {
    return url + '?' + query.join('&');
  } else {
    return url;
  }
};

export class HttpClient {
  static async get(url, params = {}, options = {}) {
    url = prepareUrl(url, params);
    options = await addAuth(options);
    return fetch(url, options);
  }

  static async post(url, data = {}, options = {}) {
    url = prepareUrl(url);
    options = await addAuth(options);
    if (data) {
      options['body'] = JSON.stringify(data);
      if (Object.keys(options).includes('headers')) {
        options['headers'].set('Content-Type', 'application/json');
      } else {
        options['headers'] = new Headers({
          'Content-Type': 'application/json',
        });
      }
    }
    options['method'] = 'POST';
    return fetch(url, options);
  }

  static async put(url, params = {}, data = {}, options = {}) {
    url = prepareUrl(url, params);
    options = await addAuth(options);
    if (data) {
      options['body'] = JSON.stringify(data);
      if (Object.keys(options).includes('headers')) {
        options['headers'].set('Content-Type', 'application/json');
      } else {
        options['headers'] = new Headers({
          'Content-Type': 'application/json',
        });
      }
    }
    options['method'] = 'PUT';
    return fetch(url, options);
  }

  static async delete(url, params = {}, options = {}) {
    url = prepareUrl(url, params);
    options = await addAuth(options);
    options['method'] = 'DELETE';
    return fetch(url, options);
  }

  static async upload(url, files, params = {}, options = {}) {
    url = prepareUrl(url);
    options = await addAuth(options);
    const formData = new FormData();
    Object.keys(files).forEach((key) => {
      formData.append(key, files[key]);
    });
    Object.keys(params).forEach((key) => {
      formData.append(key, params[key]);
    });
    options['method'] = 'POST';
    options['body'] = formData;
    return fetch(url, options);
  }

  static handleResponse(response, retType = 'json') {
    if (response.ok) {
      if (retType === 'json') {
        return response.json();
      } else {
        return response;
      }
    } else if (response.status === 401) {
      // Token is invalid or expired, clear auth and redirect to login
      AuthService.logout();
      window.location.href = '/login';
      throw new Error('Unauthorized - redirecting to login');
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
}
