import React from 'react';

import {
  Nav,
  NavList
} from '@patternfly/react-core';
import EventEmitter from 'wolfy87-eventemitter';

import { NavLink, Route, Switch } from 'react-router-dom';

import { Dashboard } from './dashboard';
import { ReportBuilder } from './report-builder';
import { RunList } from './run-list';
import { Run } from './run';
import { ResultList } from './result-list';
import { Result } from './result';
import { Settings } from './settings';
import { View, IbutsuPage } from './components';
import { HttpClient } from './services/http';
import { getActiveProject } from './utilities';
import './app.css';


export class App extends React.Component {
  constructor(props) {
    super(props);
    this.eventEmitter = new EventEmitter();
    this.state = {
      uploadFileName: '',
      importId: '',
      notifications: [],
      searchValue: '',
      views: []
    };
    this.eventEmitter.on('projectChange', () => {
      this.getViews();
    });
  }

  getViews() {
    let params = {'filter': ['type=view', 'navigable=true']};
    let project = getActiveProject();
    if (project) {
      params['filter'].push('project_id=' + project.id);
    }
    HttpClient.get([Settings.serverUrl, 'widget-config'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        data.widgets.forEach(widget => {
          if (project) {
            widget.params['project'] = project.id;
          }
          else {
            delete widget.params['project'];
          }
        });
        this.setState({views: data.widgets});
      });
  }

  componentDidMount() {
    this.getViews();
  }

  render() {
    document.title = 'Ibutsu';
    const { views } = this.state;
    const navigation = (
      <Nav onSelect={this.onNavSelect} theme="dark" aria-label="Nav">
        <NavList>
          <li className="pf-c-nav__item">
            <NavLink to="/" className="pf-c-nav__link" activeClassName="pf-m-active" exact>Dashboard</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/runs" className="pf-c-nav__link" activeClassName="pf-m-active">Runs</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/results" className="pf-c-nav__link" activeClassName="pf-m-active">Test Results</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/reports" className="pf-c-nav__link" activeClassName="pf-m-active">Report Builder</NavLink>
          </li>
          {views && views.map(view => (
            <li className="pf-c-nav__item" key={view.id}>
              <NavLink to={`/view/${view.id}`} className="pf-c-nav__link" activeClassName="pf-m-active">{view.title}</NavLink>
            </li>
          ))}
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation}>
          <Switch>
            <Route
              path="/"
              exact
              render={routerProps => (
                <Dashboard eventEmitter={this.eventEmitter} {...routerProps} />
              )}
            />
            <Route
              path="/runs"
              exact
              render={routerProps => (
                <RunList eventEmitter={this.eventEmitter} {...routerProps} />
              )}
            />
            <Route
              path="/results"
              exact
              render={routerProps => (
                <ResultList eventEmitter={this.eventEmitter} {...routerProps} />
              )}
            />
            <Route
              path="/reports"
              exact
              render={routerProps => (
                <ReportBuilder eventEmitter={this.eventEmitter} {...routerProps} />
              )}
            />
            <Route path="/runs/:id" component={Run} />
            <Route path="/results/:id" component={Result} />
            <Route path="/view/:id" component={View} />
          </Switch>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
