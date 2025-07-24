import { Settings } from '../settings';

export class AuthService {
  static loginError = null;
  static registerError = null;
  static recoverError = null;

  static isLoggedIn() {
    return Boolean(AuthService.getToken());
  }

  static getLocalUser() {
    let user = localStorage.getItem('user');
    if (user) {
      return JSON.parse(user);
    }
    return user;
  }

  static async getCurrentUser(user = null) {
    if (!user) {
      user = AuthService.getLocalUser();
    }
    try {
      const response = await fetch(Settings.serverUrl + '/user', {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Authorization: 'Bearer ' + user.token,
        },
      });
      if (response.ok) {
        return Promise.resolve(user);
      }
    } catch {
      console.warn('Stored user token is invalid, removing from localStorage');
      AuthService.logout();
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }

  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  static getToken() {
    let user = AuthService.getLocalUser();
    if (user?.token) {
      return AuthService.getCurrentUser(user).then((token) => token);
    }
  }

  static setToken(token) {
    let user = AuthService.getLocalUser();
    if (user) {
      user.token = token;
    } else {
      user = { token: token };
    }
    AuthService.setUser(user);
  }

  static register(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/register', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
      .then((response) => response.json())
      .then(() => true) // returns for register
      .catch((error) => {
        console.error(error);
        AuthService.registerError = error;
        return Promise.resolve(false);
      });
  }

  static recover(email) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/recover', {
      method: 'POST',
      body: JSON.stringify({ email: email }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
      .then((response) => {
        if (response.ok) {
          return true;
        } else {
          AuthService.recoverError = {
            message: 'There was a problem recovering your account',
          };
          return false;
        }
      })
      .catch((error) => {
        console.error(error);
        AuthService.recoverError = error;
        return false;
      });
  }

  static resetPassword(activationCode, newPassword) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        activation_code: activationCode,
        password: newPassword,
      }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
      .then((response) => {
        if (response.ok) {
          return true;
        } else {
          AuthService.resetError = {
            message: 'Invalid activation code or password',
          };
          return false;
        }
      })
      .catch((error) => {
        console.error(error);
        AuthService.resetError = error;
        return false;
      });
  }

  static login(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    return fetch(Settings.serverUrl + '/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
      .then((response) => response.json())
      .then((json) => {
        if (json.token) {
          AuthService.setUser(json);
          return true;
        } else if (json.code) {
          AuthService.loginError = json;
          return false;
        } else {
          return false;
        }
      });
  }

  static logout() {
    localStorage.removeItem('user');
  }

  static isSuperAdmin() {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    const user = AuthService.getLocalUser();
    if (!user) {
      return false;
    }
    const realUser = AuthService.getCurrentUser(user);
    if (realUser) {
      return realUser?.is_super_admin || false;
    } else {
      return false;
    }
  }
}
