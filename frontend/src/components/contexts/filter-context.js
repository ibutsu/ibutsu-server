// FilterContext.js
import { createContext, useContext } from 'react';
import useTableFilters from '../hooks/use-table-filters';
import PropTypes from 'prop-types';

export const FilterContext = createContext();
export const useFilterContext = () => useContext(FilterContext);

const FilterProvider = ({ children, ...props }) => {
  const tableFilters = useTableFilters(props);
  return (
    <FilterContext.Provider value={tableFilters}>
      {children}
    </FilterContext.Provider>
  );
};

FilterProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default FilterProvider;
