const API = '';
const TOKEN_KEY = 'fm_admin_token';

function authHeaders() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const api = {
  login: async (login, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    if (data.token) {
      try {
        sessionStorage.setItem(TOKEN_KEY, data.token);
      } catch {}
    }
    return data;
  },
  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST', body: {} });
    } finally {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {}
    }
  },
  me: () => request('/api/auth/me'),
  categories: () => request('/api/admin/categories'),
  createCategory: (body) => request('/api/admin/categories', { method: 'POST', body }),
  updateCategory: (id, body) => request(`/api/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  items: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/items${q ? `?${q}` : ''}`);
  },
  createItem: (body) => request('/api/admin/items', { method: 'POST', body }),
  updateItem: (id, body) => request(`/api/admin/items/${id}`, { method: 'PATCH', body }),
  deleteItem: (id) => request(`/api/admin/items/${id}`, { method: 'DELETE' }),
  createVariant: (itemId, body) => request(`/api/admin/items/${itemId}/variants`, { method: 'POST', body }),
  updateVariant: (id, body) => request(`/api/admin/variants/${id}`, { method: 'PATCH', body }),
  deleteVariant: (id) => request(`/api/admin/variants/${id}`, { method: 'DELETE' }),
  upload: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request('/api/admin/upload', { method: 'POST', body: fd });
  },
  audit: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/audit${q ? `?${q}` : ''}`);
  },
  auditOne: (id) => request(`/api/admin/audit/${id}`),
  admins: () => request('/api/auth/admins'),
  createAdmin: (body) => request('/api/auth/admins', { method: 'POST', body }),
};
