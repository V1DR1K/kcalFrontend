import { normalizeSession } from "./training-utils.js";

// Merge server identity only: a response must never erase edits made in flight.
export function reconcileSessionIdentity(current, submitted, response) {
  const saved = normalizeSession(response);
  const identities = new Map(submitted.exercises.filter((item) => item.exerciseId).map((item, index) => [item.id, saved.exercises[index]]));
  return { ...current, id: saved.id, version: saved.version, exercises: current.exercises.map((item) => {
    const persisted = identities.get(item.id);
    if (!persisted || String(persisted.exerciseId) !== String(item.exerciseId)) return item;
    return { ...item, persistedId: persisted.id, origin: persisted.origin, sourcePlanExerciseId: persisted.sourcePlanExerciseId };
  }) };
}

export function sessionDraftKey(userId, sessionId, type) {
  return userId ? `scalegrams.session-draft.${userId}.${sessionId || `new-${type}`}` : null;
}

export function clearSessionDrafts(storage = sessionStorage) {
  for (const key of Object.keys(storage)) if (key.startsWith("scalegrams.session-draft.")) storage.removeItem(key);
}
