import React from 'react';

import EventEmitter from 'wolfy87-eventemitter';
import ElementWrapper from './components/elementWrapper';

import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from './dashboard';
import ReportBuilder from './report-builder';
import RunList from './run-list';
import Run from './run';
import { ResultList } from './result-list';
import { Result } from './result';
import IbutsuPage from './components/ibutsu-page';
import View from './components/view';

import { IbutsuContext } from './services/context';

import './app.css';

export class App extends React.Component {
  static contextType = IbutsuContext;
  constructor (props) {
    super(props);
    this.eventEmitter = new EventEmitter();
    this.state = {
      uploadFileName: '',
      importId: '',
      searchValue: '',
      views: []
    };
  }

  render () {
    document.title = 'Ibutsu';
    return (
      <Routes>
        <Route
          path=""
          element={<ElementWrapper routeElement={IbutsuPage} eventEmitter={this.eventEmitter} />}
        />
        <Route
          path=":project_id/*"
          element={<ElementWrapper routeElement={IbutsuPage} eventEmitter={this.eventEmitter} />}
        >

          {/* Nested project routes */}
          <Route
            path="dashboard/:dashboard_id"
            element={
              <Dashboard />
            }
          />
          <Route
            path="dashboard/*"
            element={<Dashboard />}
          />


          <Route
            path="runs"
            element={<RunList />}
          />
          <Route
            path="runs/:run_id"
            element={<Run />}
          />

          <Route
            path="results"
            element={<ElementWrapper routeElement={ResultList} eventEmitter={this.eventEmitter} />}
          />
          <Route
            path="results/:result_id"
            element={<ElementWrapper routeElement={Result} />}
          />

          <Route
            path="reports"
            element={<ReportBuilder/>}
          />

          <Route
            path="view/:view_id"
            element={<View />}
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    );
  }
}
