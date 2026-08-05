import { useState, useEffect, useCallback } from 'react';

import { useSearchParams } from 'react-router';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE = 1;

// Parse a numeric search param, falling back to `fallback` only when the
// value is missing or not a valid number (unlike `Number(x) || fallback`,
// this does not discard legitimate falsy numbers such as 0). Note that
// `Number(null)` is `0`, not `NaN`, so the missing-param case (searchParams
// returns null) must be checked explicitly rather than relying on NaN alone.
const parseNumericParam = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const usePagination = ({ setParams = true }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Keep page/pageSize as numbers (not the strings URLSearchParams.get()
  // returns) since the API always responds with numeric pagination values.
  // Mismatched types here make fetch effects that depend on [page, pageSize]
  // re-fire a second time after `setPage(data.pagination.page)` etc., since
  // e.g. '1' !== 1, causing duplicate requests and a visible double-render.
  const [page, setPage] = useState(() =>
    parseNumericParam(searchParams.get('page'), DEFAULT_PAGE),
  );
  const [pageSize, setPageSize] = useState(() =>
    parseNumericParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE),
  );
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (setParams) {
      const newSearchParams = new URLSearchParams(searchParams);
      // Explicitly stringify: URLSearchParams#set does coerce via ToString
      // internally, but page/pageSize are numbers now, so stay explicit here
      // to avoid relying on that implicit coercion.
      newSearchParams.set('page', String(page));
      newSearchParams.set('pageSize', String(pageSize));
      setSearchParams(newSearchParams.toString());
      // TODO maintain window hash for Run and Result pages to have pagination params on multiple tabs
    }
  }, [page, pageSize, setParams, searchParams, setSearchParams]);

  const onSetPage = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);

  const onSetPageSize = useCallback((_, newPageSize, newPage) => {
    setPageSize(newPageSize);
    setPage(newPage);
  }, []);

  return {
    page,
    setPage,
    onSetPage,

    pageSize,
    setPageSize,
    onSetPageSize,

    totalItems,
    setTotalItems,
  };
};

export default usePagination;
