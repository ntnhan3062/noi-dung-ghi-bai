import React from 'react';
import ReactDOM from 'react-dom/client';
import { html } from './utils/html.js';
import App from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

// Register Service Worker for ultimate offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Sử dụng đường dẫn tương đối để đăng ký Service Worker giúp chạy được trên các subpath thư mục như GitHub Pages
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[Service Worker] Registration successful with scope: ', reg.scope))
      .catch((err) => console.error('[Service Worker] Registration failed: ', err));
  });
}

// Global window error listener to prevent silent white screen
window.addEventListener('error', (event) => {
  console.error('[Global Error]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(html`
    <${React.StrictMode}>
      <${ErrorBoundary}>
        <${App} />
      </${ErrorBoundary}>
    </${React.StrictMode}>
  `);
} catch (err) {
  console.error('[Root Render Crash]:', err);
  rootElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; font-family: system-ui, sans-serif; text-align: center; background-color: #f8fafc;">
      <div style="max-width: 450px; background: white; padding: 2.5rem; border-radius: 2rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <h2 style="color: #ef4444; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 800;">Có lỗi xảy ra khi tải ứng dụng</h2>
        <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">Không thể khởi tạo ứng dụng. Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.</p>
        <button onclick="window.location.reload()" style="background-color: #4f46e5; color: white; border: none; padding: 0.75rem 2rem; border-radius: 9999px; font-weight: 700; cursor: pointer; font-size: 0.9rem;">Tải lại trang</button>
      </div>
    </div>
  `;
}
