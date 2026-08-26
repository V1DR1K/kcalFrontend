const encoded = (value) => encodeURIComponent(value);

function query(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encoded(key)}=${encoded(value)}`)
    .join("&");
}

export const trainingApi = {
  dashboard: (api, date) => api.request(`/api/training/dashboard?date=${encoded(date)}`),
  calendar: (api, from, to) => api.request(`/api/training/calendar?${query({ from, to })}`),
  session: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`),
  saveSession: (api, session, payload) => api.request(session.id ? `/api/training/sessions/${encoded(session.id)}` : "/api/training/sessions", { method: session.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteSession: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`, { method: "DELETE" }),
  plans: (api, { module, includeInactive = false, page = 0, size = 50 } = {}) => api.request(`/api/training/plans?${query({ module: module === "ALL" ? undefined : module, includeInactive, page, size })}`),
  plan: (api, id) => api.request(`/api/training/plans/${encoded(id)}`),
  savePlan: (api, plan, payload) => api.request(plan?.id ? `/api/training/plans/${encoded(plan.id)}` : "/api/training/plans", { method: plan?.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  duplicatePlan: (api, id, name) => api.request(`/api/training/plans/${encoded(id)}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }),
  deletePlan: (api, id) => api.request(`/api/training/plans/${encoded(id)}`, { method: "DELETE" }),
  resolvePlan: (api, id, date) => api.request(`/api/training/plans/${encoded(id)}/resolve?date=${encoded(date)}`),
  skipPlan: (api, id, payload) => api.request(`/api/training/plans/${encoded(id)}/skip`, { method: "POST", body: JSON.stringify(payload) }),
  exercises: (api, { q, module, page = 0, size = 50 } = {}) => api.request(`/api/training/exercises?${query({ q, module: module === "ALL" ? undefined : module, page, size })}`),
  saveExercise: (api, exercise, payload) => api.request(exercise.id ? `/api/training/exercises/${encoded(exercise.id)}` : "/api/training/exercises", { method: exercise.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteExercise: (api, id) => api.request(`/api/training/exercises/${encoded(id)}`, { method: "DELETE" }),
};
