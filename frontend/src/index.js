import React from 'react';
import ReactDOM from 'react-dom';

import '@patternfly/react-core/dist/styles/base.css';

import './index.css';
import { Base } from './base';
import * as serviceWorker from './serviceWorker';

ReactDOM.render(<Base />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
