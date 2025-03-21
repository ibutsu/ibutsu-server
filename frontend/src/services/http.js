import { AuthService } from './auth';


function trim (string) {
  if (string.startsWith('/')) {
    string = string.slice(1);
  }
  if (string.endsWith('/')) {
    string = string.slice(0, -1);
  }
  return string;
}

function prepareUrl (url, params={}) {
  if (url instanceof Array) {
    let newUrl = url[0];
    url.slice(1).forEach(fragment => {
      newUrl = [newUrl, trim(fragment)].join('/');
    });
    url = newUrl;
  }
  return buildUrl(url, params);
}

function addAuth (options) {
  if (AuthService.isLoggedIn()) {
    const bearer = 'Bearer ' + AuthService.getToken();
    if (Object.keys(options).includes('headers')) {
      options['headers'].set('Authorization', bearer);
    }
    else {
      options['headers'] = new Headers({'Authorization': bearer});
    }
  }
  return options;
}

export function buildUrl (url, params) {
  // shorthand
  const esc = encodeURIComponent;
  let query = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value instanceof Array) {
      value.forEach(element => {
        query.push(esc(key) + '=' + esc(element));
      });
    }
    else {
      query.push(esc(key) + '=' + esc(value));
    }
  }
  if (query.length > 0) {
    return url + '?' + query.join('&');
  }
  else {
    return url;
  }
}

export class HttpClient {
  static get (url, params={}, options={}) {
    url = prepareUrl(url, params);
    options = addAuth(options);
    return fetch(url, options);
  }

  static post (url, data={}, options={}) {
    url = prepareUrl(url);
    options = addAuth(options);
    if (data) {
      options['body'] = JSON.stringify(data);
      if (Object.keys(options).includes('headers')) {
        options['headers'].set('Content-Type', 'application/json');
      }
      else {
        options['headers'] = new Headers({'Content-Type': 'application/json'});
      }
    }
    options['method'] = 'POST';
    return fetch(url, options);
  }

  static put (url, params={}, data={}, options={}) {
    url = prepareUrl(url, params);
    options = addAuth(options);
    if (data) {
      options['body'] = JSON.stringify(data);
      if (Object.keys(options).includes('headers')) {
        options['headers'].set('Content-Type', 'application/json');
      }
      else {
        options['headers'] = new Headers({'Content-Type': 'application/json'});
      }
    }
    options['method'] = 'PUT';
    return fetch(url, options);
  }

  static delete (url, params={}, options={}) {
    url = prepareUrl(url, params);
    options = addAuth(options);
    options['method'] = 'DELETE';
    return fetch(url, options);
  }

  static upload (url, files, params={}, options={}) {
    url = prepareUrl(url);
    options = addAuth(options);
    const formData = new FormData();
    Object.keys(files).forEach(key => {
      formData.append(key, files[key]);
    });
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });
    options['method'] = 'POST';
    options['body'] = formData;
    return fetch(url, options);
  }

  static handleResponse (response, retType='json') {
    if (response.ok) {
      if (retType === 'json') {
        return response.json();
      }
      else {
        return response;
      }
    }
    else if (response.status === 401) {
      window.location = '/login';
    }
  }
}
