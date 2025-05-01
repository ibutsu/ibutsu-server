import { useEffect } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from './dashboard';
import ReportBuilder from './report-builder';
import RunList from './run-list';
import Run from './run';
import ResultList from './result-list';
import Result from './result';
import IbutsuPage from './components/ibutsu-page';
import View from './components/view';

import './app.css';
import FilterProvider from './components/contexts/filterContext.js';
import { RESULT_FIELDS, RUN_FIELDS } from './constants';

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

        <Route path="reports" element={<ReportBuilder />} />

        <Route path="view/:view_id" element={<View />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
