const environ = process.env.NODE_ENV || 'development';

export class Settings {
  static serverUrl = process.env.REACT_APP_SERVER_URL || null;
  static isRedHatLoginEnabled = process.env.REACT_APP_REDHAT_LOGIN || false;
  static isGoogleLoginEnabled = process.env.REACT_APP_GOOGLE_LOGIN || false;
  static isGitHubLoginEnabled = process.env.REACT_APP_GITHUB_LOGIN || false;
  static isDropboxLoginEnabled = process.env.REACT_APP_DROPBOX_LOGIN || false;
  static isFacebookLoginEnabled = process.env.REACT_APP_FACEBOOK_LOGIN || false;
  static isGitLabLoginEnabled = process.env.REACT_APP_GITLAB_LOGIN || false;
}

if (environ === 'production') {
  Settings.serverUrl = '/api';
}
else {
  Settings.serverUrl = 'http://localhost:8080/api';
}
