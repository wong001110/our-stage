import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createBrowserPlatformAdapter } from './platform/browserAdapter';
import './styles.css';

if (!window.ourStage) window.ourStage = createBrowserPlatformAdapter();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
