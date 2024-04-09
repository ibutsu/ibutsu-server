import React from 'react';

import {
  Nav,
  NavList
} from '@patternfly/react-core';
import EventEmitter from 'wolfy87-eventemitter';
import ElementWrapper from './components/elementWrapper';

import { NavLink, Route, Routes } from 'react-router-dom';

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
          <li className="pf-v5-c-nav__item">
            <NavLink to="/" className="pf-v5-c-nav__link">Dashboard</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/runs" className="pf-v5-c-nav__link">Runs</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/results" className="pf-v5-c-nav__link">Test Results</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/reports" className="pf-v5-c-nav__link">Report Builder</NavLink>
          </li>
          {views && views.map(view => (
            view.widget !== "jenkins-analysis-view" && (
            <li className="pf-v5-c-nav__item" key={view.id}>
              <NavLink to={`/view/${view.id}`} className="pf-v5-c-nav__link">{view.title}</NavLink>
            </li>
            )
          ))}
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation}>
          <Routes>
            <Route path="*" element={<Dashboard eventEmitter={this.eventEmitter} />} />
            <Route path="/runs" element={<ElementWrapper routeElement={RunList} eventEmitter={this.eventEmitter} />} />
            <Route path="/results" element={<ElementWrapper routeElement={ResultList} eventEmitter={this.eventEmitter} />} />
            <Route path="/reports" element={<ElementWrapper routeElement={ReportBuilder} eventEmitter={this.eventEmitter} />} />
            <Route path="/runs/:id" element={<ElementWrapper routeElement={Run} />} />
            <Route path="/results/:id" element={<ElementWrapper routeElement={Result} />} />
            <Route path="/view/:id" element={<ElementWrapper routeElement={View} />} />
          </Routes>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
