const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listUsers: () => request("/api/users"),
  getUser: (employeeId) => request(`/api/users/${employeeId}`),

  getAccess: (employeeId) => request(`/api/access/${employeeId}`),

  getRecommendations: (employeeId, includeAi = true) =>
    request(`/api/recommendations/${employeeId}?include_ai=${includeAi}`),

  listPlatforms: () => request("/api/admin/platforms"),

  getAccessGraph: (employeeId, technology) =>
    request(`/api/access-graph/${employeeId}?technology=${encodeURIComponent(technology)}`),

  getTeamHeatmap: (team) => request(`/api/org-graph/team/${encodeURIComponent(team)}`),

  askAssistant: ({ employeeId, prompt, action, history }) =>
    request("/api/assistant/query", {
      method: "POST",
      body: JSON.stringify({ employeeId, prompt, action, history: history || [] }),
    }),
};

export { BASE_URL };
