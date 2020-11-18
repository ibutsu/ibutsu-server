import React from 'react';
import {
  Badge,
  Bullseye,
  Button,
  Spinner
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ChevronCircleRightIcon,
  ClockIcon,
  ExclamationCircleIcon,
  InfoAltIcon,
  QuestionCircleIcon,
  TimesCircleIcon
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
} from './constants';
import { ClassificationDropdown, ResultView } from './components';

export function getIconForResult(result) {
  let resultIcon = '';
  if (result === 'passed') {
    resultIcon = <CheckCircleIcon />;
  }
  else if (result === 'failed') {
    resultIcon = <TimesCircleIcon />;
  }
  else if (result === 'error') {
    resultIcon = <ExclamationCircleIcon />;
  }
  else if (result === 'skipped') {
    resultIcon = <ChevronCircleRightIcon />;
  }
  else if (result === 'xfailed') {
    resultIcon = <CheckCircleIcon />;
  }
  else if (result === 'xpassed') {
    resultIcon = <TimesCircleIcon />;
  }
  return resultIcon;
}

export function getIconForStatus(status) {
  let statusIcon = '';
  if (status === 'done') {
    statusIcon = <CheckCircleIcon />;
  }
  else if (status === 'pending') {
    statusIcon = <QuestionCircleIcon />;
  }
  else if (status === 'running') {
    statusIcon = <ClockIcon />;
  }
  else if (status === 'error') {
    statusIcon = <ExclamationCircleIcon />;
  }
  else if (status === 'empty') {
    statusIcon = <InfoAltIcon />;
  }
  return statusIcon;
}

export function toTitleCase(str, convertToSpace=false) {
  if (!str) {
    return str;
  }
  if (convertToSpace) {
    str = str.replace(/_/g, ' ');
  }
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

export function buildParams(filters) {
  let getParams = [];
  for (let key in filters) {
    if (!!filters[key] && !!filters[key]['val']) {
      const val = filters[key]['val'];
      const op = filters[key]['op'];
      getParams.push(key + '[' + op + ']=' + val);
    }
  }
  return getParams;
}

export function buildUrl(url, params) {
  // shorthand
  const esc = encodeURIComponent;
  let query = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value instanceof Array) {
      value.forEach(element => {
        query.push(esc(key) + '=' + esc(element));
      });
    }
    else {
      query.push(esc(key) + '=' + esc(value));
    }
  }
  return url + '?' + query.join('&');
}

export function round(number) {
  let rounded = Math.round(number * 10);
  return rounded / 10;
}

export function buildBadge(key, value, isRead, onClick) {
  const badge = <Badge key={key} isRead = {isRead}>{value}</Badge>;
  if (onClick) {
    return <Button key={key} variant="link" style={{padding:0}} onClick = {onClick}>{badge}</Button>
  }
  else {
    return badge;
  }
}

export function resultToRow(result, filterFunc) {
  let resultIcon = getIconForResult(result.result);
  let markers = [];
  let runLink = '';
  let classification = '';
  let badge;
  if (filterFunc) {
    badge = buildBadge('component', result.component, false,
      () => filterFunc('component', result.component));
  }
  else {
    badge = buildBadge('component', result.component, false);
  }
  markers.push(badge);
  markers.push(' ');
  if (result.metadata && result.metadata.env) {
    let badge;
    if (filterFunc) {
      badge = buildBadge(result.env, result.env, false,
        () => filterFunc('env', result.env));
    }
    else {
      badge = buildBadge(result.env, result.env, false);
    }
    markers.push(badge);
    markers.push(' ');
  }
  if (result.metadata && result.metadata.markers) {
    for (const marker of result.metadata.markers) {
      // Don't add duplicate markers
      if (markers.filter(m => m.key === marker.name).length === 0) {
        markers.push(<Badge isRead key={marker.name}>{marker.name}</Badge>);
      }
    }
  }
  if (result.metadata && result.metadata.run) {
    runLink = <Link to={`/runs/${result.run_id}`}>{result.run_id}</Link>;
  }
  if (result.metadata && result.metadata.classification) {
    classification = <Badge isRead>{result.metadata.classification.split('_')[0]}</Badge>;
  }
  return {
    "cells": [
      {title: <React.Fragment><Link to={`/results/${result.id}`}>{result.test_id}</Link> {markers}</React.Fragment>},
      {title: runLink},
      {title: <React.Fragment><span className={result.result}>{resultIcon} {toTitleCase(result.result)}</span> {classification}</React.Fragment>},
      {title: round(result.duration) + 's'},
      {title: (new Date(result.start_time).toLocaleString())}
    ]
  };
}

export function resultToClassificationRow(result, index, filterFunc) {
  let resultIcon = getIconForResult(result.result);
  let hideSummary = true;
  let hideTestObject = true;
  let markers = [];
  let exceptionBadge;

  if (filterFunc) {
    exceptionBadge = buildBadge('exception_name', result.metadata.exception_name, false,
      () => filterFunc('metadata.exception_name', result.metadata.exception_name));
  }
  else {
    exceptionBadge = buildBadge('exception_name', result.metadata.exception_name, false);
  }

  if (result.metadata && result.metadata.component) {
    markers.push(<Badge key="component">{result.metadata.component}</Badge>);
  }
  if (result.metadata && result.metadata.markers) {
    for (const marker of result.metadata.markers) {
      // Don't add duplicate markers
      if (markers.filter(m => m.key === marker.name).length === 0) {
        markers.push(<Badge isRead key={marker.name}>{marker.name}</Badge>);
      }
    }
  }

  if (result.result === "skipped") {
    hideSummary=false;
    hideTestObject=false;
  }

  return [
    // parent row
    {
      "isOpen": false,
      "cells": [
        {title: <React.Fragment><Link to={`/results/${result.id}`}>{result.test_id}</Link> {markers}</React.Fragment>},
        {title: <span className={result.result}>{resultIcon} {toTitleCase(result.result)}</span>},
        {title: <React.Fragment>{exceptionBadge}</React.Fragment>},
        {title: <ClassificationDropdown testResult={result} />},
        {title: round(result.duration) + 's'},
      ],
    },
    // child row
    {
      "parent": 2*index,
      "cells": [{title: <ResultView hideSummary={hideSummary} hideTestObject={hideTestObject} testResult={result}/>}]
    }
  ];
}

export function parseFilter(paramKey) {
  const re = /(.*?)\[(.*?)\]/;
  let match = re.exec(paramKey);
  if (match) {
    return {
      'key': match[1],
      'op': match[2]
    };
  }
  else {
    return {
      'key': paramKey,
      'op': 'eq'
    };
  }
}

export function getSpinnerRow(columnCount) {
  return {
    heightAuto: true,
    cells: [
      {
        props: {colSpan: columnCount},
        title: <Bullseye><center><Spinner size="xl"/></center></Bullseye>
      }
    ]
  };
}

export function getFilterMode(field) {
  let filterMode = 'text';
  if (field === 'run_id') {
    filterMode = 'run';
  }
  else if (field === 'result') {
    filterMode = 'result';
  }
  return filterMode;
}

export function getOperationMode(operation) {
  let operationMode = 'single';
  if (operation === 'in') {
    operationMode = 'multi';
  }
  else if (operation === 'exists') {
    operationMode = 'bool';
  }
  return operationMode;
}

export function getOperationsFromField(field) {
  let operations = OPERATIONS;  // default to all OPERATIONS
  if (ARRAY_RESULT_FIELDS.includes(field) || ARRAY_RUN_FIELDS.includes(field)) {
    operations = ARRAY_OPERATIONS;
  }
  else if (NUMERIC_RUN_FIELDS.includes(field) || NUMERIC_RESULT_FIELDS.includes(field) || NUMERIC_JJV_FIELDS.includes(field)) {
    operations = NUMERIC_OPERATIONS;
  }
  else if (STRING_RUN_FIELDS.includes(field) || STRING_RESULT_FIELDS.includes(field) || STRING_JJV_FIELDS.includes(field)) {
    operations = STRING_OPERATIONS;
  }
  return operations;
}

export function getActiveProject() {
  let project = localStorage.getItem('project');
  if (project) {
    project = JSON.parse(project);
  }
  return project;
}

export function processPyTestPath(path) {
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
}

export function convertDate(s) {
  let days = 0;
  let date = new Date(0);
  days = Math.floor(s / (24 * 60 * 60));
  if (days !== 0) {
    s = s - (days * (24 * 60 * 60));
  }
  date.setSeconds(s);
  let dayString = '';
  let timeString = date.toISOString().substring(11, 19);
  if (days === 1) {
    dayString = '1 day, ';
  }
  else if (days > 1) {
    dayString = days + ' days, ';
  }
  return '[' + dayString + timeString + ']';
}

export function cleanPath(path) {
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
}
