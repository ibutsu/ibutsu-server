import React from 'react';
import { Badge, Button, Label } from '@patternfly/react-core';
import { ChevronRightIcon } from '@patternfly/react-icons';
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
  ICON_RESULT_MAP,
  MISSING_META_EXCEPTION,
} from './constants';
import RunSummary from './components/runsummary';

// Table sorting functions for common column types
export const tableSortFunctions = {
  duration: (a, b, direction, cellIndex) => {
    // Extract duration values from cells (format: "123s")
    const getDurationValue = (durationCell) => {
      if (!durationCell) return 0;
      const cellContent =
        typeof durationCell === 'string'
          ? durationCell
          : durationCell.toString();
      const match = cellContent.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const aValue = getDurationValue(a.cells[cellIndex]);
    const bValue = getDurationValue(b.cells[cellIndex]);
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  },

  started: (a, b, direction, cellIndex) => {
    // Extract date values from cells (format: "6/4/2025, 5:16:58 AM")
    const getDateValue = (dateCell) => {
      if (!dateCell) return new Date(0);
      const cellContent =
        typeof dateCell === 'string' ? dateCell : dateCell.toString();
      const date = new Date(cellContent);
      return isNaN(date.getTime()) ? new Date(0) : date;
    };

    const aValue = getDateValue(a.cells[cellIndex]);
    const bValue = getDateValue(b.cells[cellIndex]);
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  },
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
      const apiOperation = OPERATIONS[f.operator]?.opChar;
      if (!apiOperation) {
        console.warn(
          `filtersToAPIParams: No operation found for operator '${f.operator}' in filter:`,
          f,
        );
        return `${f.field}eq${f.value}`; // Fallback to 'eq' if no operation found
      }
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

export const buildBadge = (key, value, isRead, onClick) => {
  // Ensure value is a string to avoid React child errors
  let displayValue = value;

  if (typeof value === 'object' && value !== null) {
    console.error('buildBadge: Object value passed as badge content:', value);
    displayValue = JSON.stringify(value);
  } else if (value === null || value === undefined) {
    displayValue = 'N/A';
  }

  const badge = (
    <Badge key={key} isRead={isRead}>
      {displayValue}
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

export const resultToRow = (result, filterFunc) => {
  let badges = [];
  let runLink = '';
  let classification = '';
  let componentBadge;
  const resultComponent =
    result.metadata?.component ?? result.component ?? null;
  if (resultComponent) {
    if (filterFunc) {
      componentBadge = buildBadge('component', resultComponent, false, () =>
        filterFunc({
          field: 'component',
          operator: 'eq',
          value: resultComponent,
        }),
      );
    } else {
      componentBadge = buildBadge('component', resultComponent, false);
    }
  }
  badges.push(componentBadge);
  badges.push(' ');
  const resultEnv = result.metadata?.env ?? result.env ?? null;
  if (resultEnv) {
    let envBadge;
    if (filterFunc) {
      envBadge = buildBadge(resultEnv, resultEnv, false, () =>
        filterFunc({ field: 'env', operator: 'eq', value: resultEnv }),
      );
    } else {
      envBadge = buildBadge(resultEnv, resultEnv, false);
    }
    badges.push(envBadge);
    badges.push(' ');
  }
  if (result.metadata && result.metadata.markers) {
    for (const marker of result.metadata.markers) {
      // Handle case where marker might be an object or a string
      let markName, markKey;
      markName = markKey = String(marker);
      if (marker?.name !== null && marker?.name !== undefined) {
        markName = marker.name;
        markKey = marker.name;
      } else if (typeof marker === 'object') {
        console.warn(
          'resultToRow: Object marker passed but no name property found',
          marker,
        );
      }
      // Don't add duplicate markers - check against existing React elements with keys
      const hasExistingMarker = badges.some((m) => {
        return React.isValidElement(m) && m.key === markKey;
      });

      if (!hasExistingMarker) {
        badges.push(
          <Badge isRead key={markKey}>
            {markName}
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
        {badges}
      </React.Fragment>,
      <React.Fragment key="result">
        <Label
          variant="filled"
          title={result.result}
          icon={ICON_RESULT_MAP[result.result]}
        >
          {toTitleCase(result.result)}
        </Label>
        {classification}
      </React.Fragment>,
      Math.ceil(result.duration) + 's',
      runLink,
      new Date(result.start_time).toLocaleString(),
    ],
  };
};

export const resultToComparisonRow = (result) => {
  let resultIcons = [];
  let markers = [];
  result.forEach((result) => {
    resultIcons.push(ICON_RESULT_MAP(result.result));
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
      Math.ceil(run.duration) + 's',
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

export const exceptionToBadge = (exception = null, filterFunc) => {
  let exceptionBadge;
  let exceptionName = exception || MISSING_META_EXCEPTION;

  if (filterFunc && exception) {
    exceptionBadge = buildBadge('exception_name', exceptionName, false, () =>
      filterFunc({
        field: 'metadata.exception_name',
        operator: 'eq',
        value: exceptionName,
      }),
    );
  } else {
    exceptionBadge = buildBadge('exception_name', exceptionName, false);
  }

  return exceptionBadge;
};

// TODO envToBadge and componentToBadge functions, with MISSING_ constants
