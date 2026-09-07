
import { NodeType } from '../types.js';

const API_URL = 'https://noi-dung-ghi-bai.ntnhan3062.workers.dev';

const getUrl = (endpoint) => {
  const searchParams = window.location.search;
  return `${API_URL}${endpoint}${searchParams}`;
};

export const apiService = {
  getAllNodes: async (password = null) => {
    try {
      const headers = {};
      if (password) headers['X-Auth-Pass'] = password;
      
      const response = await fetch(getUrl('/api/get'), { method: 'GET', headers: headers });
      if (response.status === 401) throw new Error('UNAUTHORIZED');
      if (!response.ok) throw new Error('Network response was not ok');
      const text = await response.text();
      if (!text || !text.trim() || text.trim().startsWith('<')) {
        if (text && text.trim().startsWith('<')) {
          throw new Error('SERVER_HTML_ERROR');
        }
        return [];
      }
      try { return JSON.parse(text); } catch (e) { 
        console.error("JSON parse error:", e, "Text:", text.substring(0, 50));
        throw new Error('INVALID_JSON');
      }
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') throw error;
      console.error("API Error in getAllNodes:", error);
      throw error;
    }
  },

  saveNode: async (node) => {
    try {
      const payload = {
        id: node.id || Math.random().toString(36).substr(2, 9),
        parentId: node.parentId || null,
        type: node.type,
        title: node.title,
        content: node.content || '',
        createdAt: node.createdAt || Date.now(),
        orderIndex: node.orderIndex !== undefined ? node.orderIndex : 0,
        classId: node.classId || null
      };
      const response = await fetch(getUrl('/api/save'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Save failed');
      return await response.json();
    } catch (error) { throw error; }
  },

  batchUpdateNodes: async (updates) => {
    try {
      const response = await fetch(getUrl('/api/batch-update'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      if (!response.ok) throw new Error('Batch update failed');
      return true;
    } catch (error) { return false; }
  },

  deleteNode: async (id) => {
    try {
      const response = await fetch(getUrl('/api/delete'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error('Delete failed');
      return true;
    } catch (error) { return false; }
  },
  
  verifyPassword: async (password) => {
    try {
      const response = await fetch(getUrl('/api/auth/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      return response.status === 200;
    } catch (error) { return false; }
  },

  changePassword: async (newPassword) => {
    try {
      const response = await fetch(getUrl('/api/auth/change-password'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) });
      return response.ok;
    } catch (error) { return false; }
  },

  getFullConfig: async () => {
    try {
        const response = await fetch(getUrl('/api/config/full'));
        if (!response.ok) return { classes: [], background: { images: [], active: false }, ui: { style: 'liquid', zoom: { view: true, edit: true, app: false } } };
        return await response.json();
    } catch (e) {
        return { classes: [], background: { images: [], active: false }, ui: { style: 'liquid', zoom: { view: true, edit: true, app: false } } };
    }
  },

  saveFullConfig: async (config) => {
    try {
        const response = await fetch(getUrl('/api/config/full'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return response.ok;
    } catch (e) { return false; }
  }
};
