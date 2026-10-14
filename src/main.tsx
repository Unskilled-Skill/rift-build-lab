import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {ProviderRefreshProvider} from './ProviderRefresh';
import './styles.css';
import './design-refinements.css';
import './improvements.css';
import './meta.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ProviderRefreshProvider><App/></ProviderRefreshProvider></React.StrictMode>);
