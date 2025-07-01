import { Settings } from '../pages/settings';

export class AuthService {
  static loginError = null;
  static registerError = null;
  static recoverError = null;

  static async isLoggedIn() {
    return Boolean(await AuthService.getCurrentUser());
  }

  static getUser() {
    let user = localStorage.getItem('user');
    console.log('getLocalUser', user);
    if (user) {
      return JSON.parse(user);
    }
    return user;
  }

  static async getCurrentUser(user = null) {
    console.log('getCurrentUser', user);
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
      console.log('getCurrentUser response', response);
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

  static async getToken() {
    let user = AuthService.getLocalUser();
    console.log('getToken', user);
    if (user?.token) {
      const userObj = await AuthService.getCurrentUser(user);
      return userObj?.token || null;
    }
    return null;
  }

  static setToken(token) {
    let user = AuthService.getUser();
    if (user) {
      user.token = token;
    } else {
      user = { token: token };
    }
    AuthService.setUser(user);
  }

  static async register(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    try {
      const response = await fetch(Settings.serverUrl + '/login/register', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password }),
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
      await response.json();
      return true;
    } catch (error) {
      console.error(error);
      AuthService.registerError = error;
      return false;
    }
  }

  static async recover(email) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    try {
      const response = await fetch(Settings.serverUrl + '/login/recover', {
        method: 'POST',
        body: JSON.stringify({ email: email }),
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });

      if (response.ok) {
        return true;
      } else {
        AuthService.recoverError = {
          message: 'There was a problem recovering your account',
        };
        return false;
      }
    } catch (error) {
      console.error(error);
      AuthService.recoverError = error;
      return false;
    }
  }

  static async resetPassword(activationCode, newPassword) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    try {
      const response = await fetch(
        Settings.serverUrl + '/login/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            activation_code: activationCode,
            password: newPassword,
          }),
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        },
      );

      if (response.ok) {
        return true;
      } else {
        AuthService.resetError = {
          message: 'Invalid activation code or password',
        };
        return false;
      }
    } catch (error) {
      console.error(error);
      AuthService.resetError = error;
      return false;
    }
  }

  static async login(email, password) {
    // Cannot use the HttpClient service here, otherwise we have circular imports
    try {
      const response = await fetch(Settings.serverUrl + '/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password }),
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });

      const json = await response.json();
      if (json.token) {
        AuthService.setUser(json);
        // Don't set cached user and validation flags yet - let them be set properly
        // when getCurrentUser is called, which will fetch complete user data
        AuthService._tokenValidated = false;
        AuthService._cachedUser = null;

        return true;
      } else if (json.code) {
        AuthService.loginError = json;
        return false;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  static logout() {
    localStorage.removeItem('user');
  }

  static async isSuperAdmin() {
    // Use cached user if available
    if (AuthService._cachedUser && AuthService._tokenValidated) {
      return AuthService._cachedUser?.is_superadmin || false;
    }

    // Otherwise, get current user
    const user = AuthService.getLocalUser();
    if (!user) {
      return false;
    }

    const realUser = await AuthService.getCurrentUser(user);
    if (realUser) {
      AuthService._cachedUser = realUser;
      AuthService._tokenValidated = true;
      return realUser?.is_superadmin || false;
    } else {
      return false;
    }
  }
}
