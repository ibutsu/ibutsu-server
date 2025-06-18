import React from 'react';
import { Badge, Bullseye, Button, Spinner } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ChevronCircleRightIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationCircleIcon,
  FileIcon,
  InfoAltIcon,
  QuestionCircleIcon,
  TimesCircleIcon,
  FlagIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import {
  OPERATIONS,
  ARRAY_OPERATIONS,
  ARRAY_RESULT_FIELDS,
  ARRAY_RUN_FIELDS,
  STRING_OPERATIONS,
  STRING_JJV_FIELDS,
  STRING_RUN_FIELDS,
  STRING_RESULT_FIELDS,
  NUMERIC_JJV_FIELDS,
  NUMERIC_OPERATIONS,
  NUMERIC_RESULT_FIELDS,
  NUMERIC_RUN_FIELDS,
  THEME_KEY,
  CHART_COLOR_MAP,
} from './constants';
import RunSummary from './components/runsummary';

export const getDateString = () => {
  return String(new Date().getTime());
};

export const iconResultMap = {
  passed: <CheckCircleIcon style={{ color: CHART_COLOR_MAP.passed }} />,
  failed: <TimesCircleIcon style={{ color: CHART_COLOR_MAP.failed }} />,
  error: <ExclamationCircleIcon style={{ color: CHART_COLOR_MAP.error }} />,
  skipped: (
    <ChevronCircleRightIcon style={{ color: CHART_COLOR_MAP.skipped }} />
  ),
  xfailed: <CheckCircleIcon style={{ color: CHART_COLOR_MAP.xfailed }} />,
  xpassed: <TimesCircleIcon style={{ color: CHART_COLOR_MAP.xpassed }} />,
  manual: <FlagIcon style={{ color: CHART_COLOR_MAP.manual }} />,
  pending: <QuestionCircleIcon style={{ color: CHART_COLOR_MAP.skipped }} />,
};

export const iconStatusMap = {
  done: <CheckCircleIcon />,
  pending: <QuestionCircleIcon />,
  running: <ClockIcon />,
  error: <ExclamationCircleIcon />,
  empty: <InfoAltIcon />,
};

// Helper function to get a styled result icon
export const getStyledResultIcon = (result, className = '') => {
  const icon = iconResultMap[result];
  if (!icon) return null;

  const combinedClassName = `result-icon-${result} ${className}`.trim();
  return <span className={combinedClassName}>{icon}</span>;
};

// Helper function to get a styled status icon
export const getStyledStatusIcon = (status, className = '') => {
  const icon = iconStatusMap[status];
  if (!icon) return null;

  const combinedClassName = `status-icon-${status} ${className}`.trim();
  return <span className={combinedClassName}>{icon}</span>;
};

export const toTitleCase = (str, convertToSpace = false) => {
  if (!str) {
    return str;
  }
  if (convertToSpace) {
    str = str.replace(/_/g, ' ');
  }
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

export const filtersToAPIParams = (filters = []) => {
  if (filters?.length) {
    return filters.map((f) => {
      const apiOperation = OPERATIONS[f.operator].opChar;
      return `${f.field}${apiOperation}${f.value}`;
    });
  } else {
    // empty array by default to appease API
    return [];
  }
};

export const filtersToSearchParams = (filters = []) => {
  // Compose the '[op]value' for search params
  const newSearchParams = new URLSearchParams();
  filters.forEach((filter) => {
    newSearchParams.set([filter.field], `[${filter.operator}]${filter.value}`);
  });
  return newSearchParams.toString();
};

export const toAPIFilter = (filters) => {
  // Take UI style filter object with field/op/val keys and generate an array of filter strings for the API
  // TODO rework for array of filters instead of keyed object
  let filter_strings = [];
  for (const key in filters) {
    if (
      Object.prototype.hasOwnProperty.call(filters, key) &&
      !!filters[key] &&
      key !== 'id'
    ) {
      const val = filters[key]['val'];
      const op = OPERATIONS[filters[key]['operator']].opChar;
      filter_strings.push(key + op + val);
    }
  }
  return filter_strings;
};

export const round = (number) => {
  let rounded = Math.round(number * 10);
  return rounded / 10;
};

export const buildBadge = (key, value, isRead, onClick) => {
  const badge = (
    <Badge key={key} isRead={isRead}>
      {value}
    </Badge>
  );
  if (onClick) {
    return (
      <Button key={key} variant="link" style={{ padding: 0 }} onClick={onClick}>
        {badge}
      </Button>
    );
  } else {
    return badge;
  }
};

export const buildResultsTree = (treeResults) => {
  const getPassPercent = (stats) => {
    let percent = 'N/A';
    if (stats.count > 0) {
      percent = Math.round(
        ((stats.passed + stats.xfailed) / stats.count) * 100,
      );
    }
    return percent;
  };

  const getBadgeClass = (passPercent) => {
    let className = 'failed';
    if (passPercent > 75) {
      className = 'error';
    }
    if (passPercent > 90) {
      className = 'passed';
    }
    return className;
  };

  let treeStructure = [];
  treeResults.forEach((testResult) => {
    const pathParts = processPyTestPath(cleanPath(testResult.metadata.fspath));
    let children = treeStructure;
    pathParts.forEach((dirName) => {
      let child = children.find((item) => item.name == dirName);
      if (!child) {
        child = {
          name: dirName,
          id: dirName,
          children: [],
          hasBadge: true,
          _stats: {
            count: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            error: 0,
            xpassed: 0,
            xfailed: 0,
          },
        };
        if (dirName.endsWith('.py')) {
          child.icon = <FileIcon />;
          child.expandedIcon = <FileIcon />;
        }
        children.push(child);
      }
      child._stats[testResult.result] += 1;
      child._stats.count += 1;
      const passPercent = getPassPercent(child._stats);
      const className = getBadgeClass(passPercent);
      child.customBadgeContent = `${passPercent}%`;
      child.badgeProps = { className: className };
      children = child.children;
    });
    let icon = getStyledResultIcon(testResult.result);

    children.push({
      id: testResult.id,
      name: testResult.test_id,
      icon: icon,
      _testResult: testResult,
    });
  });
  return treeStructure;
};

export const generateId = (length) => {
  let resultId = '';
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsLength = chars.length;
  let counter = 0;
  while (counter < length) {
    resultId += chars.charAt(Math.floor(Math.random() * charsLength));
    counter += 1;
  }
  return resultId;
};

export const resultToRow = (result, filterFunc) => {
  let resultIcon = getStyledResultIcon(result.result);
  let markers = [];
  let runLink = '';
  let classification = '';
  let componentBadge;
  if (filterFunc) {
    componentBadge = buildBadge('component', result.component, false, () =>
      filterFunc({
        field: 'component',
        operator: 'eq',
        value: result.component,
      }),
    );
  } else {
    componentBadge = buildBadge('component', result.component, false);
  }
  markers.push(componentBadge);
  markers.push(' ');
  if (result.metadata && result.metadata.env) {
    let envBadge;
    if (filterFunc) {
      envBadge = buildBadge(result.env, result.env, false, () =>
        filterFunc({ field: 'env', operator: 'eq', value: result.env }),
      );
    } else {
      envBadge = buildBadge(result.env, result.env, false);
    }
    markers.push(envBadge);
    markers.push(' ');
  }
  if (result.metadata && result.metadata.markers) {
    for (const marker of result.metadata.markers) {
      // Don't add duplicate markers
      if (markers.filter((m) => m.key === marker.name).length === 0) {
        markers.push(
          <Badge isRead key={marker.name}>
            {marker.name}
          </Badge>,
        );
      }
    }
  }
  if (result.metadata && result.metadata.run) {
    runLink = (
      <Link to={`../runs/${result.run_id}#summary`} relative="Path">
        {result.run_id}
      </Link>
    );
  }
  if (result.metadata && result.metadata.classification) {
    classification = (
      <Badge isRead>{result.metadata.classification.split('_')[0]}</Badge>
    );
  }
  return {
    cells: [
      <React.Fragment key={result.id}>
        <Link
          to={`../results/${result.id}#summary`}
          relative="Path"
          key={result.id}
        >
          {result.test_id}
        </Link>{' '}
        {markers}
      </React.Fragment>,
      <React.Fragment key="result">
        <span className={result.result}>
          {resultIcon} {toTitleCase(result.result)}
        </span>{' '}
        {classification}
      </React.Fragment>,
      round(result.duration) + 's',
      runLink,
      new Date(result.start_time).toLocaleString(),
    ],
  };
};

export const resultToComparisonRow = (result) => {
  let resultIcons = [];
  let markers = [];
  result.forEach((result) => {
    resultIcons.push(getStyledResultIcon(result.result));
    if (result.metadata && result.metadata.markers) {
      for (const marker of result.metadata.markers) {
        // Don't add duplicate markers
        if (markers.filter((m) => m.key === marker).length === 0) {
          markers.push(
            <Badge isRead key={marker}>
              {marker}
            </Badge>,
          );
        }
      }
    }
  });

  if (result[0].metadata && result[0].metadata.component) {
    markers.push(
      <Badge key={result[0].metadata.component}>
        {result[0].metadata.component}
      </Badge>,
    );
  }

  let cells = [];
  cells.push(
    <React.Fragment key="test">
      <Link to={`../results/${result[0].id}#summary`} relative="Path">
        {result[0].test_id}
      </Link>{' '}
      {markers}
    </React.Fragment>,
  );
  result.forEach((result, index) => {
    cells.push(
      <span key={`result-${index}`} className={result.result}>
        {resultIcons[index]} {toTitleCase(result.result)}
      </span>,
    );
  });

  return {
    id: result[0].id,
    result: result,
    cells: cells,
  };
};

export const runToRow = (run, filterFunc) => {
  let badges = [];
  let created = 0;
  let componentBadge;
  if (run.start_time) {
    created = new Date(run.start_time);
  } else {
    created = new Date(run.created);
  }

  if (filterFunc) {
    if (run.component) {
      componentBadge = buildBadge('component', run.component, false, () =>
        filterFunc({
          field: 'component',
          operator: 'eq',
          value: run.component,
        }),
      );
    }
  } else {
    componentBadge = buildBadge('component', run.component, false);
  }
  badges.push(componentBadge);

  if (run.env) {
    let envBadge;
    if (filterFunc) {
      envBadge = buildBadge(run.env, run.env, false, () =>
        filterFunc({ field: 'env', operator: 'eq', value: run.env }),
      );
    } else {
      envBadge = buildBadge(run.env, run.env, false);
    }
    badges.push(envBadge);
  }
  return {
    cells: [
      <React.Fragment key="run">
        <Link to={`${run.id}#summary`}>{run.id}</Link> {badges}
      </React.Fragment>,
      round(run.duration) + 's',
      <RunSummary key="summary" summary={run.summary} />,
      created.toLocaleString(),
      <Link
        key="see-results"
        to={{
          pathname: '../results',
          search: filtersToSearchParams([
            { field: 'run_id', operator: 'eq', value: run.id },
          ]),
        }}
        relative="Path"
      >
        See results <ChevronRightIcon />
      </Link>,
    ],
  };
};

export const parseSearchToFilter = (searchParamTuple) => {
  const re = /\[(?<operator>.*?)\](?<value>.*)?/;
  let match = re.exec(searchParamTuple[1]);
  if (match) {
    return {
      field: searchParamTuple[0],
      operator: match.groups['operator'],
      value: match.groups['value'],
    };
  }
  return null;
};

export const parseFilterValueToSearch = (filter) => {
  return `[${filter.operator}]${filter.value}`;
};

export const parseFilter = (paramKey) => {
  const re = /(.*?)\[(.*?)\]/;
  let match = re.exec(paramKey);
  if (match) {
    return {
      key: match[1],
      operator: match[2],
    };
  } else {
    return {
      key: paramKey,
      operator: 'eq',
    };
  }
};

export const getSpinnerRow = (columnCount) => {
  return {
    heightAuto: true,
    cells: [
      {
        props: { colSpan: columnCount },
        title: (
          <Bullseye>
            <center>
              <Spinner size="xl" />
            </center>
          </Bullseye>
        ),
      },
    ],
  };
};

export const getFilterMode = (field) => {
  let filterMode = 'text';
  if (field === 'run_id') {
    filterMode = 'run';
  } else if (field === 'result') {
    filterMode = 'result';
  }
  return filterMode;
};

export const getOperationMode = (operation) => {
  let operationMode = 'single';
  if (operation === 'in') {
    operationMode = 'multi';
  } else if (operation === 'exists') {
    operationMode = 'bool';
  }
  return operationMode;
};

// TODO move the spec for this into the constant object
// The hook needs to then dereference from there, currently fieldSelection is just the `value`
export const getOperationsFromField = (field) => {
  let operations = OPERATIONS; // default to all OPERATIONS
  if (
    ARRAY_RESULT_FIELDS.map((f) => f.value).includes(field) ||
    ARRAY_RUN_FIELDS.map((f) => f.value).includes(field)
  ) {
    operations = ARRAY_OPERATIONS;
  } else if (
    NUMERIC_RUN_FIELDS.map((f) => f.value).includes(field) ||
    NUMERIC_RESULT_FIELDS.map((f) => f.value).includes(field) ||
    NUMERIC_JJV_FIELDS.includes(field)
  ) {
    operations = NUMERIC_OPERATIONS;
  } else if (
    STRING_RUN_FIELDS.map((f) => f.value).includes(field) ||
    STRING_RESULT_FIELDS.map((f) => f.value).includes(field) ||
    STRING_JJV_FIELDS.includes(field)
  ) {
    operations = STRING_OPERATIONS;
  }
  return operations;
};

export const projectToOption = (project) => {
  if (!project) {
    return '';
  }
  return {
    project: project,
    toString: function () {
      return this.project.title;
    },
    compareTo: function (value) {
      if (value.project) {
        return this.project.id === value.project.id;
      } else {
        return (
          this.project.name.toLowerCase().includes(value.toLowerCase()) ||
          this.project.title.toLowerCase().includes(value.toLowerCase())
        );
      }
    },
  };
};

export const dashboardToOption = (dashboard) => {
  if (!dashboard) {
    return '';
  }
  return {
    dashboard: dashboard,
    toString: function () {
      return this.dashboard.title;
    },
    compareTo: function (value) {
      if (value.dashboard) {
        return this.dashboard.id === value.dashboard.id;
      } else {
        return this.dashboard.title.toLowerCase().includes(value.toLowerCase());
      }
    },
  };
};

export const processPyTestPath = (path) => {
  if (path && path.indexOf('/') === 0) {
    path = path.substring(1);
  }
  let segEnd = path.indexOf('/');
  let paramStart = path.indexOf('[');
  if (segEnd === -1 || (paramStart !== -1 && paramStart < segEnd)) {
    // Definitely a final segment
    return [path];
  }
  let segment = path.substring(0, segEnd);
  let rest = path.substring(segEnd + 1);
  return [segment, ...processPyTestPath(rest)];
};

export const convertDate = (s) => {
  let days = 0;
  let date = new Date(0);
  days = Math.floor(s / (24 * 60 * 60));
  if (days !== 0) {
    s = s - days * (24 * 60 * 60);
  }
  date.setSeconds(s);
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

export const getDarkTheme = () => {
  // check local storage and browser theme for a preference
  const local_theme = localStorage.getItem(THEME_KEY);
  if (local_theme) {
    return local_theme === 'dark';
  } else {
    let browser_preference = window.matchMedia('(prefers-color-scheme: dark)');
    return Boolean(browser_preference.matches);
  }
};

export const setDocumentDarkTheme = (theme = null) => {
  // Sets light theme on false, dark theme on true
  let set_dark = theme !== null ? theme : getDarkTheme();

  localStorage.setItem('theme', set_dark ? 'dark' : 'light');
  if (set_dark) {
    document.firstElementChild.classList.add('pf-v6-theme-dark');
  } else {
    document.firstElementChild.classList.remove('pf-v6-theme-dark');
  }
};
