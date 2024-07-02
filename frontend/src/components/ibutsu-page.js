{/* TODO: Consider renaming to projects-page, maybe updates for static routing? */}

import React from 'react';
import PropTypes from 'prop-types';

import { Outlet } from 'react-router-dom';

import {
  Alert,
  AlertGroup,
  AlertVariant,
  Page,
} from '@patternfly/react-core';

import ElementWrapper from './elementWrapper';
import { IbutsuHeader } from '../components';
import { ALERT_TIMEOUT } from '../constants';
import { getDateString, getTheme } from '../utilities';
import { IbutsuContext } from '../services/context';
import IbutsuSidebar from './sidebar';


export class IbutsuPage extends React.Component {
  static contextType = IbutsuContext;

  static propTypes = {
    eventEmitter: PropTypes.object,
    navigation: PropTypes.node,
    location: PropTypes.object,
    children: PropTypes.node,
    title: PropTypes.string,
    params: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.state = {
      notifications: [],
      views: []
    };
    this.props.eventEmitter.on('showNotification', (type, title, message, action, timeout, key) => {
      this.showNotification(type, title, message, action, timeout, key);
    });
    this.props.eventEmitter.on('themeChange', this.setTheme);
    this.props.eventEmitter.on('projectChange', () => {
    });
    // TODO: empty state props.children override

  }

  showNotification(type, title, message, action, timeout, key) {
    let notifications = this.state.notifications;
    let alertKey = key || getDateString();
    timeout = timeout !== undefined ? timeout : true
    if (notifications.find(element => element.key === alertKey) !== undefined) {
      return;
    }
    let notification = {
      'key': alertKey,
      'type': AlertVariant[type],
      'title': title,
      'message': message,
      'action': action
    };
    notifications.push(notification);
    this.setState({notifications}, () => {
      if (timeout === true) {
        setTimeout(() => {
          let notifs = this.state.notifications.filter((n) => {
            if (n.type === type && n.title === title && n.message === message) {
              return false;
            }
            return true;
          });
          this.setState({notifications: notifs});
        }, ALERT_TIMEOUT);
      }
    });
  }

  setTheme() {
    const isDarkTheme = getTheme() === 'dark';
    if (isDarkTheme) {
      document.documentElement.classList.add('pf-v5-theme-dark');
    }
    else {
      document.documentElement.classList.remove('pf-v5-theme-dark');
    }
  }

  componentDidMount() {
    this.setTheme();
  }

  render() {
    document.title = this.props.title || 'Ibutsu';
    return (
      <React.Fragment>
        <AlertGroup isToast>
          {this.state.notifications.map((notification) => (
            <Alert key={notification.key} variant={notification.type} title={notification.title} actionLinks={notification.action} timeout={ALERT_TIMEOUT} isLiveRegion>
              {notification.message}
            </Alert>
          ))}
        </AlertGroup>
        <Page
          header={<ElementWrapper routeElement={IbutsuHeader} eventEmitter={this.props.eventEmitter}/>}
          sidebar={<IbutsuSidebar eventEmitter={this.props.eventEmitter} />}
          isManagedSidebar={true}
          style={{position: "relative"}}
        >
          <Outlet/>
        </Page>
      </React.Fragment>
    );
  }
}
