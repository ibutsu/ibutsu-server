export const toTitleCase = (str, convertToSpace = false) => {
  if (!str) {
    return str;
  }
  let processedStr = str;
  if (convertToSpace) {
    processedStr = processedStr.replace(/_/g, ' ');
  }
  return processedStr.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  });
};

export const processPyTestPath = (path) => {
  let processedPath = path;
  if (processedPath && processedPath.indexOf('/') === 0) {
    processedPath = processedPath.substring(1);
  }
  let segEnd = processedPath.indexOf('/');
  let paramStart = processedPath.indexOf('[');
  if (segEnd === -1 || (paramStart !== -1 && paramStart < segEnd)) {
    // Definitely a final segment
    return [processedPath];
  }
  let segment = processedPath.substring(0, segEnd);
  let rest = processedPath.substring(segEnd + 1);
  return [segment, ...processPyTestPath(rest)];
};

export const convertDate = (s) => {
  let remainingSeconds = s;
  let days = 0;
  let date = new Date(0);
  days = Math.floor(remainingSeconds / (24 * 60 * 60));
  if (days !== 0) {
    remainingSeconds -= days * (24 * 60 * 60);
  }
  date.setSeconds(remainingSeconds);
  let dayString = '';
  let timeString = date.toISOString().substring(11, 19);
  if (days === 1) {
    dayString = '1 day, ';
  } else if (days > 1) {
    dayString = days + ' days, ';
  }
  return '[' + dayString + timeString + ']';
};

export const cleanPath = (path) => {
  if (!path) {
    // if xml imported results have no fspath
    return 'Tests';
  }
  let pathParts = path.split('/');
  // Do this first to reduce looping below
  if (pathParts.indexOf('site-packages') !== -1) {
    pathParts = pathParts.slice(pathParts.indexOf('site-packages') + 1);
  }
  while (pathParts.length > 0 && pathParts.indexOf('..') === 0) {
    pathParts = pathParts.slice(1);
  }
  return pathParts.join('/');
};
