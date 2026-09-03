const encoded = (value) => encodeURIComponent(value);

function query(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encoded(key)}=${encoded(value)}`)
    .join("&");
}

export const trainingApi = {
  cardio: (api, { page = 0, size = 50 } = {}) => api.request(`/api/training/cardio?${query({ page, size })}`),
  cardioSummary: (api) => api.request("/api/training/cardio/summary"),
  saveCardio: (api, record, payload) => api.request(record?.id ? `/api/training/cardio/${encoded(record.id)}` : "/api/training/cardio", { method: record?.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteCardio: (api, id) => api.request(`/api/training/cardio/${encoded(id)}`, { method: "DELETE" }),
  createCardioService: (api, payload) => api.request("/api/training/cardio/services", { method: "POST", body: JSON.stringify(payload) }),
  dashboard: (api, date) => api.request(`/api/training/dashboard?date=${encoded(date)}`),
  calendar: (api, from, to) => api.request(`/api/training/calendar?${query({ from, to })}`),
  session: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`),
  createSession: (api, payload) => api.request("/api/training/sessions", { method: "POST", body: JSON.stringify(payload) }),
  saveSession: (api, session, payload) => api.request(session.id ? `/api/training/sessions/${encoded(session.id)}` : "/api/training/sessions", { method: session.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  completeSession: (api, id, payload = {}) => api.request(`/api/training/sessions/${encoded(id)}/complete`, { method: "POST", body: JSON.stringify({ version: payload.version ?? null, persistPlanChanges: Boolean(payload.persistPlanChanges) }) }),
  cancelSession: (api, id, payload = {}) => api.request(`/api/training/sessions/${encoded(id)}/cancel`, { method: "POST", body: JSON.stringify({ version: payload.version ?? null }) }),
  deleteSession: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`, { method: "DELETE" }),
  plans: (api, { module, includeInactive = false, page = 0, size = 50 } = {}) => api.request(`/api/training/plans?${query({ module: module === "ALL" ? undefined : module, includeInactive, page, size })}`),
  plan: (api, id) => api.request(`/api/training/plans/${encoded(id)}`),
  savePlan: (api, plan, payload) => api.request(plan?.id ? `/api/training/plans/${encoded(plan.id)}` : "/api/training/plans", { method: plan?.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  duplicatePlan: (api, id, name) => api.request(`/api/training/plans/${encoded(id)}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }),
  deletePlan: (api, id) => api.request(`/api/training/plans/${encoded(id)}`, { method: "DELETE" }),
  resolvePlan: (api, id, date) => api.request(`/api/training/plans/${encoded(id)}/resolve?date=${encoded(date)}`),
  skipPlan: (api, id, payload) => api.request(`/api/training/plans/${encoded(id)}/skip`, { method: "POST", body: JSON.stringify(payload) }),
  categories: (api, { q, module, includeInactive = false, page = 0, size = 50 } = {}) => api.request(`/api/training/categories?${query({ q, module: module === "ALL" ? undefined : module, includeInactive, page, size })}`),
  category: (api, id) => api.request(`/api/training/categories/${encoded(id)}`),
  saveCategory: (api, category, payload) => api.request(category?.id ? `/api/training/categories/${encoded(category.id)}` : "/api/training/categories", { method: category?.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteCategory: (api, id) => api.request(`/api/training/categories/${encoded(id)}`, { method: "DELETE" }),
  exercises: (api, { q, module, category, categoryId, equipment, difficulty, registrationType, includeInactive = false, page = 0, size = 50 } = {}) => api.request(`/api/training/exercises?${query({ q, module: module === "ALL" ? undefined : module, category, categoryId, equipment, difficulty, registrationType, includeInactive, page, size })}`),
  exercise: (api, id) => api.request(`/api/training/exercises/${encoded(id)}`),
  saveExercise: (api, exercise, payload) => api.request(exercise.id ? `/api/training/exercises/${encoded(exercise.id)}` : "/api/training/exercises", { method: exercise.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteExercise: (api, id) => api.request(`/api/training/exercises/${encoded(id)}`, { method: "DELETE" }),
};
