/**
 * Centralized API service for Autovix
 */
const API_BASE = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '');

let authToken = localStorage.getItem('autovix_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('autovix_token', token);
  } else {
    localStorage.removeItem('autovix_token');
  }
}

export function getAuthToken() {
  return authToken;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = options.headers ? { ...options.headers } : {};

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Set Content-Type only if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errorDetail = errorJson.error.message;
      } else if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorDetail = errorJson.detail;
        } else if (errorJson.detail.message) {
          errorDetail = errorJson.detail.message;
        } else {
          errorDetail = JSON.stringify(errorJson.detail);
        }
      }
    } catch {
      errorDetail = response.statusText || `HTTP ${response.status}`;
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  // Handle blob/download responses
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('text/plain') || contentType.includes('application/octet-stream') || contentType.includes('text/csv'))) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  // Public service health (the API may return HTTP 503 when its local model is unavailable).
  async getHealth() {
    const response = await fetch(`${API_BASE}/health`);
    let data = null;
    try {
      data = await response.json();
    } catch {
      // A non-JSON health response is represented as an unavailable service below.
    }
    return { ...data, apiReady: response.ok || response.status === 503 };
  },

  // Authentication & Session
  async getSession() {
    const data = await request('/auth/session');
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async login(username, password) {
    const data = await request('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async getMe() {
    return request('/auth/me');
  },

  // Projects
  async getProjects() {
    return request('/projects');
  },

  async createProject(name) {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async getProject(projectId) {
    return request(`/projects/${projectId}`);
  },

  async getProjectStats(projectId) {
    return request(`/projects/${projectId}/stats`);
  },

  // Documents
  async getDocuments(projectId) {
    return request(`/projects/${projectId}/documents`);
  },

  async getDocumentDetails(projectId, documentId) {
    return request(`/projects/${projectId}/documents/${documentId}`);
  },

  async uploadDocument(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  async downloadDocument(projectId, documentId) {
    const blob = await request(`/projects/${projectId}/documents/${documentId}/download`);
    return blob;
  },

  async deleteDocument(projectId, documentId) {
    return request(`/projects/${projectId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // RAG / Ask AI
  async askAI(projectId, question) {
    return request(`/projects/${projectId}/query`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },



  // Traceability Entities
  async getTraceability(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/projects/${projectId}/traceability${query ? `?${query}` : ''}`);
  },

  async getDocumentEntities(projectId, documentId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/projects/${projectId}/documents/${documentId}/entities${query ? `?${query}` : ''}`);
  },

  async recognizeDocumentEntities(projectId, documentId, version, { force = false } = {}) {
    const query = new URLSearchParams();
    if (version !== undefined && version !== null && String(version).trim() !== '') {
      query.set('version', String(version));
    }
    if (force === true || force === 'true') query.set('force', 'true');
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : '';
    return request(`/projects/${projectId}/documents/${documentId}/entities/recognize${suffix}`, { method: 'POST' });
  },

  async getDocumentEntity(projectId, documentId, entityId) {
    return request(`/projects/${projectId}/documents/${documentId}/entities/${entityId}`);
  },

  async getDocumentReviews(projectId, documentId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/projects/${projectId}/documents/${documentId}/reviews${query ? `?${query}` : ''}`);
  },

  async getDocumentReviewSummary(projectId, documentId) {
    return request(`/projects/${projectId}/documents/${documentId}/reviews/summary`);
  },

  async getDocumentSignoff(projectId, documentId) {
    return request(`/projects/${projectId}/documents/${documentId}/reviews/signoff`);
  },

  async signoffDocument(projectId, documentId) {
    return request(`/projects/${projectId}/documents/${documentId}/reviews/signoff`, { method: 'POST' });
  },

  async submitAnswerForReview(projectId, documentId, payload) {
    return request(`/projects/${projectId}/documents/${documentId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async reviewItem(projectId, documentId, itemType, itemId, action, payload = {}) {
    return request(`/projects/${projectId}/documents/${documentId}/reviews/${itemType}/${itemId}/${action}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async bulkApproveReviews(projectId, documentId, itemIds, itemType = 'entity') {
    return request(`/projects/${projectId}/documents/${documentId}/reviews/bulk-approve`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds, item_type: itemType }),
    });
  },

  async exportDocumentEntities(projectId, documentId, format = 'csv') {
    return request(`/projects/${projectId}/documents/${documentId}/entities/export/${format}`);
  },

  // Comparison
  async compareDocuments(projectId, baselineDocumentId, currentDocumentId) {
    return request(`/projects/${projectId}/compare`, {
      method: 'POST',
      body: JSON.stringify({
        baseline_document_id: baselineDocumentId,
        current_document_id: currentDocumentId,
      }),
    });
  },

  async compareFiles(projectId, baselineFile, currentFile) {
    const formData = new FormData();
    formData.append('baseline_file', baselineFile);
    formData.append('current_file', currentFile);
    return request(`/projects/${projectId}/compare/files`, {
      method: 'POST',
      body: formData,
    });
  },

  // Audit Logs
  async getAuditLogs(projectId, limit = 100) {
    return request(`/projects/${projectId}/audit?limit=${limit}`);
  },

  async logAuditEvent(projectId, eventData) {
    return request(`/projects/${projectId}/audit/log`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  // Exports
  async exportData(projectId, artifact, format = 'json', params = {}) {
    const query = new URLSearchParams({ format, ...params }).toString();
    return request(`/projects/${projectId}/exports/${artifact}?${query}`);
  },
};
