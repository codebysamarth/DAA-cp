// Small wrapper around fetch for the backend REST API.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  info: () => request('GET', '/api/info'),
  savedResults: () => request('GET', '/api/results'),
  simulate: (params) => request('POST', '/api/simulate', params),
  compareOne: (params) => request('POST', '/api/compare', params),
  scalabilityOne: (params) => request('POST', '/api/scalability', params),
  ablationOne: (params) => request('POST', '/api/ablation', params),
};
