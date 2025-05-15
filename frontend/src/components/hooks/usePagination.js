import { useState } from 'react';

import { useSearchParams } from 'react-router-dom';

const usePagination = ({}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleChangePage = (_, newPage) => {
    setPage(parseInt(newPage, 1));
  };

  const handleChangeRowsPerPage = (_, newPageSize, newPage) => {
    setPageSize(parseInt(newPageSize, 20));
    setPage(1);
  };

  return {
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
  };
};

usePagination.propTypes = {
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  handleChangePage: PropTypes.func,
  handleChangeRowsPerPage: PropTypes.func,
};

export default usePagination;
