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

// Consolidated filter formatting and parsing utilities
const OP_RE = /^\[(?<operator>[^\]]+)\](?<value>.*)$/;

export function formatFilter(
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

export function parseFilterParam([rawKey, rawVal]) {
  const match = OP_RE.exec(rawVal);
  if (match) {
    const { operator, value } = match.groups;
    return { field: rawKey, operator, value };
  }
  return { field: rawKey, operator: 'eq', value: rawVal };
}

// Simplified API functions using the consolidated utilities
export const filtersToAPIParams = (filters = []) =>
  filters.length ? filters.map((f) => formatFilter(f, { forAPI: true })) : [];

export const filtersToSearchParams = (filters = []) =>
  filters.reduce((qs, f) => {
    qs.set(f.field, formatFilter(f));
    return qs;
  }, new URLSearchParams());

export const toAPIFilter = (filters) => {
  // Take UI style filter object with field/op/val keys and generate an array of filter strings for the API
  // TODO rework for array of filters instead of keyed object
  const filter_strings = [];
  for (const key in filters) {
    if (
      Object.prototype.hasOwnProperty.call(filters, key) &&
      !!filters[key] &&
      key !== 'id'
    ) {
      const val = filters[key]['val'];
      const operator = filters[key]['operator'];
      filter_strings.push(
        formatFilter({ field: key, operator, value: val }, { forAPI: true }),
      );
    }
  }
  return filter_strings;
};

export const parseSearchToFilter = parseFilterParam;

export const parseFilterValueToSearch = (filter) => formatFilter(filter);

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
