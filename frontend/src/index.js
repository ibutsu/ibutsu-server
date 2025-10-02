import { createRoot } from 'react-dom/client';

import '@patternfly/react-core/dist/styles/base.css';
import '@patternfly/patternfly/patternfly-charts.css';
import './index.css';
import './app.css';
import { setDocumentDarkTheme } from './utilities';

import { Base } from './routes/base';
import * as serviceWorker from './pages/service-worker';

setDocumentDarkTheme();
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Base />);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
