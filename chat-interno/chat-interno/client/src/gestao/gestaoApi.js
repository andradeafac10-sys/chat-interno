// client/src/gestao/gestaoApi.js
// Helper central pra chamar o backend do Painel Gestão.
// Usa o mesmo token de login que o resto do sistema já usa.

const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/api/gestao${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // resposta sem corpo (ex: 204)
  }

  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (${res.status})`);
  }
  return data;
}

export const gestaoApi = {
  listTasks: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    const qs = new URLSearchParams(clean).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  overview: () => request('/tasks/overview'),
  assignableUsers: () => request('/tasks/meta/assignees'),
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (payload) => request('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (id, payload) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  addChecklistItem: (id, title) =>
    request(`/tasks/${id}/checklist`, { method: 'POST', body: JSON.stringify({ title }) }),
  toggleChecklistItem: (id, itemId, is_done) =>
    request(`/tasks/${id}/checklist/${itemId}`, { method: 'PUT', body: JSON.stringify({ is_done }) }),
  deleteChecklistItem: (id, itemId) =>
    request(`/tasks/${id}/checklist/${itemId}`, { method: 'DELETE' }),
  addComment: (id, content) =>
    request(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Rotinas (tarefas recorrentes)
  listRecurrences: () => request('/recurrences'),
  createRecurrence: (payload) => request('/recurrences', { method: 'POST', body: JSON.stringify(payload) }),
  updateRecurrence: (id, payload) => request(`/recurrences/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteRecurrence: (id) => request(`/recurrences/${id}`, { method: 'DELETE' }),
  generateOccurrencesNow: () => request('/recurrences/generate', { method: 'POST' }),
};
