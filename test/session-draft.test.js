import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSessionIdentity, sessionDraftKey } from "../src/features/training/session-draft.js";
import { sessionPayload } from "../src/features/training/training-utils.js";

test("a delayed response merges identity without overwriting typing or remounting the row", () => {
  const snapshot = { exercises: [{ id: "local-key", exerciseId: 10, notes: "", sets: [{ reps: "8", completed: false }] }] };
  const current = { ...snapshot, notes: "", date: "2026-10-01", exercises: [{ ...snapshot.exercises[0], sets: [{ reps: "12", completed: true }] }] };
  const saved = { id: 1, version: 2, exercises: [{ id: 55, exerciseId: 10, sets: [{ id: 66, repetitions: 8 }] }] };
  const merged = reconcileSessionIdentity(current, snapshot, saved);
  assert.equal(merged.exercises[0].id, "local-key");
  assert.equal(merged.exercises[0].sets[0].reps, "12");
  assert.equal(sessionPayload(merged, "GYM").exercises[0].id, 55);
  assert.equal(merged.version, 2);
});
test("an in-flight replacement never inherits the previous exercise's identity", () => {
  const merged = reconcileSessionIdentity({ exercises: [{ id: "new", exerciseId: 11 }] }, { exercises: [{ id: "old", exerciseId: 10 }] }, { id: 1, exercises: [{ id: 55, exerciseId: 10 }] });
  assert.equal(merged.exercises[0].persistedId, undefined);
});
test("draft keys separate users, sessions, and new-session modules", () => {
  assert.notEqual(sessionDraftKey(1, 5, "GYM"), sessionDraftKey(2, 5, "GYM"));
  assert.notEqual(sessionDraftKey(1, null, "GYM"), sessionDraftKey(1, null, "CALISTHENICS"));
  assert.equal(sessionDraftKey(null, 5, "GYM"), null);
});
