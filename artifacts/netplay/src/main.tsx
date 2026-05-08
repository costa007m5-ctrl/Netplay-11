import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// StrictMode removed in production for performance (no double-renders)
// Firebase removed: was initialized but its exports (auth, db, analytics) were never used anywhere
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
