// FilterContext.js
import { createContext, useContext } from 'react';
import useTableFilters from '../hooks/use-table-filters';

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

export default FilterProvider;
