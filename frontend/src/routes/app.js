import { useEffect, lazy, Suspense } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import IbutsuPage from './ibutsu-page';

import '../app.css';
import FilterProvider from '../components/contexts/filter-context.js';
import { RESULT_FIELDS, RUN_FIELDS } from '../constants';
import { ContentSpinner } from '../components/loading-spinners';

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('../pages/dashboard'));
const RunList = lazy(() => import('../pages/run-list'));
const Run = lazy(() => import('../pages/run'));
const ResultList = lazy(() => import('../pages/result-list'));
const Result = lazy(() => import('../pages/result'));
const View = lazy(() => import('../pages/View'));

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
        <Route
          path="dashboard/:dashboard_id"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="dashboard/*"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <Dashboard />
            </Suspense>
          }
        />

        <Route
          path="runs"
          element={
            // set key to force mount on FilterProviders
            // RunList uses RunFilters
            <FilterProvider key="runs" fieldOptions={RUN_FIELDS}>
              <Suspense fallback={<ContentSpinner />}>
                <RunList />
              </Suspense>
            </FilterProvider>
          }
        />
        <Route
          path="runs/:run_id"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <Run />
            </Suspense>
          }
        />

        <Route
          path="results"
          element={
            // ResultList uses ResultFilters
            <FilterProvider key="results" fieldOptions={RESULT_FIELDS}>
              <Suspense fallback={<ContentSpinner />}>
                <ResultList />
              </Suspense>
            </FilterProvider>
          }
        />
        <Route
          path="results/:result_id"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <Result />
            </Suspense>
          }
        />

        <Route
          path="view/:view_id"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <View />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
