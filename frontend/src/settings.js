const environ = process.env.NODE_ENV || 'development';
const serverUrl = process.env.REACT_APP_SERVER_URL || null;

export class Settings {
}

if (serverUrl) {
  Settings.serverUrl = serverUrl;
}
else if (environ === 'production') {
  Settings.serverUrl = '/api';
}
else {
  Settings.serverUrl = 'http://localhost:8080/api';
}
