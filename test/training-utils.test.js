import test from "node:test";
import assert from "node:assert/strict";
import { monthDays, moveItem, sessionPayload } from "../src/features/training/training-utils.js";

test("crea una grilla mensual que inicia el lunes", () => {
  const days = monthDays(new Date(2026, 2, 1));
  assert.equal(days.length, 37);
  assert.deepEqual(days.slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(days[6], "2026-03-01");
});

test("reordena elementos sin mutar la lista original", () => {
  const original = ["uno", "dos", "tres"];
  assert.deepEqual(moveItem(original, 0, 2), ["dos", "tres", "uno"]);
  assert.deepEqual(original, ["uno", "dos", "tres"]);
});

test("no envía pesos en sesiones de calistenia", () => {
  const payload = sessionPayload({ date: "2026-08-26", routineId: "", durationMinutes: 30, notes: "", exercises: [{ exerciseId: "pull-up", name: "Dominadas", notes: "", sets: [{ reps: "8", weightKg: "24" }] }] }, "CALISTHENICS");
  assert.deepEqual(payload.exercises[0].sets[0], { reps: 8, position: 0 });
  assert.equal(JSON.stringify(payload).includes("weight"), false);
});

test("incluye peso en sesiones de gimnasio", () => {
  const payload = sessionPayload({ date: "2026-08-26", routineId: "", durationMinutes: 30, notes: "", exercises: [{ exerciseId: "squat", name: "Sentadilla", notes: "", sets: [{ reps: "5", weightKg: "80" }] }] }, "GYM");
  assert.equal(payload.exercises[0].sets[0].weightKg, 80);
});
