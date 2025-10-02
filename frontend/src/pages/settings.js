/*
Set some settings from public/settings.js. The reason we set settings in this way is so
that we can set them via environment variables at container runtime.

cf.
https://levelup.gitconnected.com/handling-multiple-environments-in-react-with-docker-543762989783
*/
export var Settings;

// If no settings are defined in the window (i.e. in the tests), use defaults
Settings = window.settings
  ? window.settings
  : {
      serverUrl: 'http://localhost:8080/api',
      environment: 'development',
    };
