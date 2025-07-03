import { Settings } from '../pages/settings';

export class AuthService {
  static loginError = null;
  static registerError = null;
  static recoverError = null;
  static _cachedUser = null;
  static _tokenValidated = false;

  static async isLoggedIn() {
    const user = AuthService.getLocalUser();
    if (!user || !user.token) {
      return false;
    }

    // If we've already validated the token in this session, don't validate again
    if (AuthService._tokenValidated && AuthService._cachedUser) {
      return true;
    }

    // Validate token with server
    try {
      const validUser = await AuthService.getCurrentUser(user);
      if (validUser) {
        AuthService._tokenValidated = true;
        AuthService._cachedUser = validUser;
        return true;
      } else {
        AuthService._tokenValidated = false;
        AuthService._cachedUser = null;
        return false;
      }
    } catch (error) {
      console.error(
        'AuthService.isLoggedIn: Token validation failed with error:',
        error,
      );
      AuthService._tokenValidated = false;
      AuthService._cachedUser = null;
      return false;
    }
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

    if (!user || !user.token) {
      return null;
    }

    try {
      const response = await fetch(Settings.serverUrl + '/user', {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Authorization: 'Bearer ' + user.token,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        // Merge the server data with the local token
        return { ...userData, token: user.token };
      } else if (response.status === 401) {
        // Token is invalid
        console.warn('Token is invalid, removing from localStorage');
        AuthService.logout();
        return null;
      }
    } catch (error) {
      console.warn('Error validating token:', error);
      // Don't logout on network errors, just return null
      return null;
    }
    return null;
  }

  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  static async getToken() {
    // Use cached user if token is validated
    if (AuthService._tokenValidated && AuthService._cachedUser?.token) {
      return AuthService._cachedUser.token;
    }

    let user = AuthService.getLocalUser();

    if (user?.token) {
      // Validate token before returning it
      const userObj = await AuthService.getCurrentUser(user);
      if (userObj?.token) {
        AuthService._tokenValidated = true;
        AuthService._cachedUser = userObj;
        return userObj.token;
      }
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
      console.error('AuthService.login: Network error during login:', error);
      AuthService.loginError = { message: 'Network error during login' };
      return false;
    }
  }

  static logout() {
    localStorage.removeItem('user');
    // Reset validation flags on logout
    AuthService._tokenValidated = false;
    AuthService._cachedUser = null;
    AuthService.loginError = null;
    AuthService.registerError = null;
    AuthService.recoverError = null;
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
