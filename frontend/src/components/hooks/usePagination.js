import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';

import { useSearchParams } from 'react-router-dom';

const DEFAULT_PAGE_SIZE = '20';
const DEFAULT_PAGE = '1';

const usePagination = ({ setParams = true }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(searchParams.get('page') || DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(
    searchParams.get('pageSize') || DEFAULT_PAGE_SIZE,
  );
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (setParams) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('page', page);
      newSearchParams.set('pageSize', pageSize);
      setSearchParams(newSearchParams.toString());
      // maintain window hash for Run and Result pages to have pagination params on multiple tabs
    }
  }, [page, pageSize, setParams, searchParams, setSearchParams]);

  const onSetPage = useCallback((_, newPage) => {
    setPage(parseInt(newPage));
  }, []);

  const onSetPageSize = useCallback((_, newPageSize, newPage) => {
    setPage(parseInt(newPage));
    setPageSize(parseInt(newPageSize));
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

usePagination.propTypes = {
  setParams: PropTypes.bool,
};

export default usePagination;
