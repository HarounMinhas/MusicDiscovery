import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import NavigationInterceptor from './routing/NavigationInterceptor';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <NavigationInterceptor />
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}
