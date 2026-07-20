// FilterContext.js
import { createContext, useContext } from 'react';
import useTableFilters from '../hooks/use-table-filters';

export const FilterContext = createContext();
export const useFilterContext = () => useContext(FilterContext);

const FilterProvider = ({ children, ...props }) => {
  const tableFilters = useTableFilters(props);
  return <FilterContext value={tableFilters}>{children}</FilterContext>;
};

export default FilterProvider;
