import { createRoot } from 'react-dom/client';

import '@patternfly/react-core/dist/styles/base.css';
import '@patternfly/patternfly/patternfly-charts.css';
import './index.css';
import './app.css';
import { setDocumentDarkTheme } from './utilities';

import { Base } from './routes/base';

setDocumentDarkTheme();
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Base />);
