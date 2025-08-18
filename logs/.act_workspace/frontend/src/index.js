import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';

// Point axios at the API when there's no reverse-proxy in front
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// Bootstrap Icons CSS
//<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);