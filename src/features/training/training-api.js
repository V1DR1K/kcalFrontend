const encoded = (value) => encodeURIComponent(value);

export const trainingApi = {
  dashboard: (api, date) => api.request(`/api/training/dashboard?date=${encoded(date)}`),
  calendar: (api, date) => api.request(`/api/training/calendar?year=${date.getFullYear()}&month=${date.getMonth() + 1}`),
  session: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`),
  saveSession: (api, session, payload) => api.request(session.id ? `/api/training/sessions/${encoded(session.id)}` : "/api/training/sessions", { method: session.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteSession: (api, id) => api.request(`/api/training/sessions/${encoded(id)}`, { method: "DELETE" }),
  routines: (api) => api.request("/api/training/routines"),
  saveRoutine: (api, routine, payload) => api.request(routine.id ? `/api/training/routines/${encoded(routine.id)}` : "/api/training/routines", { method: routine.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  duplicateRoutine: (api, id) => api.request(`/api/training/routines/${encoded(id)}/duplicate`, { method: "POST" }),
  deleteRoutine: (api, id) => api.request(`/api/training/routines/${encoded(id)}`, { method: "DELETE" }),
  exercises: (api) => api.request("/api/training/exercises"),
  saveExercise: (api, exercise, payload) => api.request(exercise.id ? `/api/training/exercises/${encoded(exercise.id)}` : "/api/training/exercises", { method: exercise.id ? "PUT" : "POST", body: JSON.stringify(payload) }),
  deleteExercise: (api, id) => api.request(`/api/training/exercises/${encoded(id)}`, { method: "DELETE" }),
};
