import { Settings } from '../settings';

export class AuthService {
  static loginError = null;
  static registerError = null;
  static recoverError = null;

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

  static register(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/register', {
      method: 'POST',
      body: JSON.stringify({email: email, password: password}),
      headers: {'Content-Type': 'application/json; charset=UTF-8'}
    })
      .then(response => response.json())
      .then(() => {
        return true;
      })
      .catch(error => {
        console.log(error);
        AuthService.registerError = error;
        return false;
      });
  }

  static recover(email) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/recover', {
      method: 'POST',
      body: JSON.stringify({email: email}),
      headers: {'Content-Type': 'application/json; charset=UTF-8'}
    })
      .then((response) => {
        if (response.ok) {
          return true;
        }
        else {
          AuthService.recoverError = {message: 'There was a problem recovering your account'}
          return false;
        }
      })
      .catch(error => {
        console.log(error);
        AuthService.recoverError = error;
        return false;
      });
  }

  static resetPassword(activationCode, newPassword) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/reset-password', {
      method: 'POST',
      body: JSON.stringify({activation_code: activationCode, password: newPassword}),
      headers: {'Content-Type': 'application/json; charset=UTF-8'}
    })
      .then(response => {
        if (response.ok) {
          return true;
        }
        else {
          AuthService.resetError = {message: 'Invalid activation code or password'};
          return false;
        }
      })
      .catch(error => {
        console.log(error);
        AuthService.resetError = error;
        return false;
      });
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
      });
  }

  static logout() {
    localStorage.removeItem('user');
  }

  static isSuperAdmin() {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    const user = AuthService.getUser();
    if (!user) {
      return false;
    }
    return fetch(Settings.serverUrl + '/user', {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + user.token
      }
    })
      .then(response => response.json())
      .then(json => {
        return json.is_superadmin;
      });
  }
}
