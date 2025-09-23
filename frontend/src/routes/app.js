import { useEffect } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/dashboard';
import RunList from '../pages/run-list';
import Run from '../pages/run';
import ResultList from '../pages/result-list';
import Result from '../pages/result';
import IbutsuPage from './ibutsu-page';
import View from '../pages/View';

import '../app.css';
import FilterProvider from '../components/contexts/filter-context.js';
import { RESULT_FIELDS, RUN_FIELDS } from '../constants';

const App = () => {
  // apparently it's good practice to set this after render via effect
  useEffect(() => {
    document.title = 'Ibutsu';
  }, []);

  return (
    <Routes>
      <Route path="" element={<IbutsuPage />} />
      <Route path=":project_id/*" element={<IbutsuPage />}>
        {/* Nested project routes */}
        <Route path="dashboard/:dashboard_id" element={<Dashboard />} />
        <Route path="dashboard/*" element={<Dashboard />} />

        <Route
          path="runs"
          element={
            // set key to force mount on FilterProviders
            // RunList uses RunFilters
            <FilterProvider key="runs" fieldOptions={RUN_FIELDS}>
              <RunList />
            </FilterProvider>
          }
        />
        <Route path="runs/:run_id" element={<Run />} />

        <Route
          path="results"
          element={
            // ResultList uses ResultFilters
            <FilterProvider key="results" fieldOptions={RESULT_FIELDS}>
              <ResultList />
            </FilterProvider>
          }
        />
        <Route path="results/:result_id" element={<Result />} />

        <Route path="view/:view_id" element={<View />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
