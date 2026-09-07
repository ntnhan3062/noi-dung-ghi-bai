import React from 'react';
import ReactDOM from 'react-dom/client';
import { html } from './utils/html.js';
import App from './App.js';

// Register Service Worker for ultimate offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Sử dụng đường dẫn tương đối để đăng ký Service Worker giúp chạy được trên các subpath thư mục như GitHub Pages
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[Service Worker] Registration successful with scope: ', reg.scope))
      .catch((err) => console.error('[Service Worker] Registration failed: ', err));
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(html`
  <${React.StrictMode}>
    <${App} />
  </${React.StrictMode}>
`);