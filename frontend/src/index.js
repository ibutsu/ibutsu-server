import React from 'react';
import ReactDOM from 'react-dom';

import '@patternfly/patternfly/patternfly.css';

import { Base } from './base';
import * as serviceWorker from './serviceWorker';

import '@patternfly/patternfly/patternfly-theme-dark.css';
import './index.css';

ReactDOM.render(<Base />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
