import React from 'react';
import { html } from '../utils/html.js';
import { StatusPage } from './StatusPage.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error?.message || String(error));
  }

  render() {
    if (this.state.hasError) {
      return html`
        <${StatusPage} 
          type="source-error" 
          subMessage=${this.state.error?.message || "Đã xảy ra sự cố kỹ thuật trong ứng dụng. Vui lòng tải lại trang."}
        />
      `;
    }

    return this.props.children;
  }
}

