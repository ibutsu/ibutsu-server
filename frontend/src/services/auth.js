import { Settings } from '../settings';

export class AuthService {
  static loginError = null;

  static isLoggedIn() {
    if (AuthService.getToken()) {
      return true;
    }
    return false;
  }

  static getUser() {
    let user = localStorage.getItem('user');
    if (user) {
      return JSON.parse(user);
    }
    return user;
  }

  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  static getToken() {
    let user = AuthService.getUser();
    if (user && user.token) {
      return user.token;
    }
    return null;
  }

  static setToken(token) {
    let user = AuthService.getUser();
    if (user) {
      user.token = token;
    }
    else {
      user = {"token": token};
    }
    AuthService.setUser(user);
  }

  static login(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login', {
      method: 'POST',
      body: JSON.stringify({email: email, password: password}),
      headers: {'Content-Type': 'application/json; charset=UTF-8'}
    })
      .then(response => response.json())
      .then(json => {
        if (json.token) {
          AuthService.setUser(json);
          return true;
        }
        else if (json.code) {
          AuthService.loginError = json;
          return false;
        }
        else {
          return false;
        }
      })
      .catch(() => false);
  }

  static logout() {
    localStorage.removeItem('user');
  }
}
