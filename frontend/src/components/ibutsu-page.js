import React from 'react';
import PropTypes from 'prop-types';

import {
  Alert,
  AlertActionLink,
  AlertGroup,
  AlertVariant,
  Page,
  PageSidebar,
} from '@patternfly/react-core';

import { IbutsuHeader } from '../components';
import { ALERT_TIMEOUT, VERSION_CHECK_TIMEOUT } from '../constants';
import { HttpClient } from '../services/http';
import { getDateString, getTheme } from '../utilities';
import { version } from '../../package.json'


export class IbutsuPage extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object,
    navigation: PropTypes.node,
    children: PropTypes.node,
    title: PropTypes.string
  }

  constructor(props) {
    super(props);
    this.versionCheckId = '';
    this.state = {
      notifications: [],
      version: version
    };
    this.props.eventEmitter.on('showNotification', (type, title, message, action, timeout, key) => {
      this.showNotification(type, title, message, action, timeout, key);
    });
    this.props.eventEmitter.on('themeChange', this.setTheme);
  }

  showNotification(type, title, message, action?, timeout?, key?) {
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
      document.documentElement.classList.add('pf-theme-dark');
    }
    else {
      document.documentElement.classList.remove('pf-theme-dark');
    }
  }

  checkVersion() {
    const frontendUrl = window.location.origin;
    HttpClient.get([frontendUrl, 'version.json'], {'v': getDateString()})
      .then(response => HttpClient.handleResponse(response))
      .then((data) => {
        if (data && data.version && (data.version !== this.state.version)) {
          const action = <AlertActionLink onClick={() => { window.location.reload(); }}>Reload</AlertActionLink>;
          this.showNotification('info', 'Ibutsu has been updated', 'A newer version of Ibutsu is available, click reload to get it.', action, true, 'check-version');
        }
      });
  }

  componentWillUnmount() {
    if (this.versionCheckId) {
      clearInterval(this.versionCheckId);
    }
  }

  componentDidMount() {
    this.setTheme();
    this.checkVersion();
    this.versionCheckId = setInterval(() => this.checkVersion(), VERSION_CHECK_TIMEOUT);
  }

  render() {
    document.title = this.props.title || 'Ibutsu';
    return (
      <React.Fragment>
        <AlertGroup isToast>
          {this.state.notifications.map((notification) => (
            <Alert key={notification.key} variant={notification.type} title={notification.title} action={notification.action} isLiveRegion>
              {notification.message}
            </Alert>
          ))}
        </AlertGroup>
        <Page header={<IbutsuHeader eventEmitter={this.props.eventEmitter} version={this.state.version} />} sidebar={<PageSidebar nav={this.props.navigation} theme="dark" />} isManagedSidebar={true} style={{position: "relative"}}>
          {this.props.children}
        </Page>
      </React.Fragment>
    );
  }
}
