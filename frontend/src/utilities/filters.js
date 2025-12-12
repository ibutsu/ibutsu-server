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
} from '../constants';

export const filtersToAPIParams = (filters = []) => {
  return filters.length
    ? filters.map((f) => formatFilterForAPI(f, { forAPI: true }))
    : [];
};

export function formatFilterForAPI(
  { field, operator, value },
  { forAPI = false } = {},
) {
  const opChar = OPERATIONS[operator]?.opChar || OPERATIONS.eq.opChar;
  if (forAPI) {
    if (!OPERATIONS[operator]?.opChar) {
      console.warn(
        `formatFilter: No operation found for operator '${operator}' in filter:`,
        { field, operator, value },
      );
    }
    return `${field}${opChar}${value}`;
  }
  return `[${operator}]${value}`;
}

// Regex to match operator patterns in filter values
const OP_RE = /^\[(.+)\](.+)$/;

export function parseFilterParam([rawKey, rawVal]) {
  const match = OP_RE.exec(rawVal);
  if (match) {
    const operator = match[1];
    const value = match[2];
    return { field: rawKey, operator, value };
  }
  return { field: rawKey, operator: 'eq', value: rawVal };
}

// Simplified API functions using the consolidated utilities
export const filtersToAPIParamsV2 = (filters = []) =>
  filters.length
    ? filters.map((f) => formatFilterForAPI(f, { forAPI: true }))
    : [];

export const filtersToSearchParams = (filters = []) =>
  filters.reduce((qs, f) => {
    qs.set(f.field, formatFilterForAPI(f, { forAPI: false }));
    return qs;
  }, new URLSearchParams());

export const toAPIFilter = (filterObj) => {
  return Object.entries(filterObj)
    .filter(([key, cfg]) => {
      // Skip 'id' key, null/undefined configs, and filters with undefined values
      return key !== 'id' && cfg && cfg.val !== undefined;
    })
    .map(([key, { operator, val }]) =>
      formatFilterForAPI(
        { field: key, operator, value: val },
        { forAPI: true },
      ),
    );
};

export const parseSearchToFilter = parseFilterParam;

export const parseFilterValueToSearch = (filter) =>
  formatFilterForAPI(filter, { forAPI: false });

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

/**
 * Convert API filter strings back to filter objects
 * @param {string} filterString - Comma-separated API filter string like "field=value,field2>value2"
 * @returns {Array} Array of filter objects with field, operator, and value
 */
export const apiParamsToFilters = (filterString = '') => {
  if (typeof filterString !== 'string' || !filterString.trim()) return [];

  // Create reverse mapping from opChar to operator key
  const opCharToOperator = Object.entries(OPERATIONS).reduce(
    (acc, [op, { opChar }]) => ({ ...acc, [opChar]: op }),
    {},
  );

  // Build a regex that matches the longest ops first (>=, <=, !=, then =, >, <, etc)
  const opCharsPattern = Object.keys(opCharToOperator)
    .map((c) => c.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'))
    .sort((a, b) => b.length - a.length)
    .join('|');
  const FILTER_RE = new RegExp(`^(.+)(${opCharsPattern})(.+)$`);

  return filterString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((str) => {
      const m = str.match(FILTER_RE);
      if (m) {
        return {
          field: m[1],
          operator: opCharToOperator[m[2]],
          value: m[3],
        };
      }
      // fallback to eq if no match
      const [field, value] = str.split('=');
      return { field, operator: 'eq', value };
    });
};

// Field to operations lookup map - replaces the long conditional chain
const FIELD_OPS = {
  // Array fields
  ...ARRAY_RESULT_FIELDS.concat(ARRAY_RUN_FIELDS).reduce(
    (m, { value }) => ({ ...m, [value]: ARRAY_OPERATIONS }),
    {},
  ),
  // Numeric fields
  ...NUMERIC_RESULT_FIELDS.concat(NUMERIC_RUN_FIELDS)
    .concat(NUMERIC_JJV_FIELDS.map((f) => ({ value: f })))
    .reduce((m, { value }) => ({ ...m, [value]: NUMERIC_OPERATIONS }), {}),
  // String fields
  ...STRING_RESULT_FIELDS.concat(STRING_RUN_FIELDS)
    .concat(STRING_JJV_FIELDS.map((f) => ({ value: f })))
    .reduce((m, { value }) => ({ ...m, [value]: STRING_OPERATIONS }), {}),
};

export const getOperationsFromField = (field) => FIELD_OPS[field] || OPERATIONS;
