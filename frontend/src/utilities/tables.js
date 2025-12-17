import { Fragment, isValidElement } from 'react';
import { Badge, Label } from '@patternfly/react-core';
import ChevronRightIcon from '@patternfly/react-icons/dist/esm/icons/chevron-right-icon';
import { Link } from 'react-router-dom';
import { ICON_RESULT_MAP } from '../constants';
import RunSummary from '../components/run-summary';
import { buildBadge } from './badges';
import { toTitleCase } from './strings';
import { filtersToSearchParams } from './filters';

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
        return isValidElement(m) && m.key === markKey;
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
      <Fragment key={result.id}>
        <Link
          to={`../results/${result.id}#summary`}
          relative="Path"
          key={result.id}
        >
          {result.test_id}
        </Link>{' '}
        {badges}
      </Fragment>,
      <Fragment key="result">
        <Label
          variant="filled"
          title={result.result}
          icon={ICON_RESULT_MAP[result.result]}
        >
          {toTitleCase(result.result)}
        </Label>
        {classification}
      </Fragment>,
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
    <Fragment key="test">
      <Link to={`../results/${result[0].id}#summary`} relative="Path">
        {result[0].test_id}
      </Link>{' '}
      {markers}
    </Fragment>,
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
      <Fragment key="run">
        <Link to={`${run.id}#summary`}>{run.id}</Link> {badges}
      </Fragment>,
      Math.ceil(run.duration) + 's',
      <RunSummary key="summary" summary={run.summary} />,
      created.toLocaleString(),
      <Link
        key="see-results"
        to={{
          pathname: '../results',
          search: filtersToSearchParams([
            { field: 'run_id', operator: 'eq', value: run.id },
          ]).toString(),
        }}
        relative="Path"
      >
        See results <ChevronRightIcon />
      </Link>,
    ],
  };
};

// TODO envToBadge and componentToBadge functions, with MISSING_ constants
