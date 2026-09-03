import test from "node:test";
import assert from "node:assert/strict";
import { cardioPayload, cardioProgress, formatCardioMinutes } from "../src/features/training/cardio-utils.js";
import { monthDays, moveItem, normalizeSession, planPayload, sessionPayload, sessionStatusLabel } from "../src/features/training/training-utils.js";

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
  const payload = sessionPayload({ date: "2026-08-26", planId: "", planDayId: "", title: "", durationMinutes: 30, notes: "", exercises: [{ exerciseId: "12", targetSets: 3, targetRepetitions: 8, targetWeightKg: "24", name: "Dominadas", notes: "", sets: [{ reps: "8", weightKg: "24" }] }] }, "CALISTHENICS");
  assert.deepEqual(payload.exercises[0].sets[0], { setNumber: 1, repetitions: 8, completed: false, notes: null });
  assert.equal(payload.module, "CALISTHENICS");
  assert.equal(JSON.stringify(payload).includes("weight"), false);
});

test("incluye peso en sesiones de gimnasio", () => {
  const payload = sessionPayload({ date: "2026-08-26", planId: "", planDayId: "", title: "", durationMinutes: 30, notes: "", exercises: [{ exerciseId: "12", targetSets: 3, targetRepetitions: 5, targetWeightKg: "80", name: "Sentadilla", notes: "", sets: [{ reps: "5", weightKg: "80" }] }] }, "GYM");
  assert.equal(payload.exercises[0].sets[0].weightKg, 80);
});

test("serializa un plan canónico y limpia el día en modo dinámico", () => {
  const payload = planPayload({ name: "Fuerza", description: "", module: "CALISTHENICS", frequencyMode: "DYNAMIC", targetSessionsPerWeek: "3", startDate: "2026-08-26", endDate: "", active: true, days: [{ name: "Tirón", dayOfWeek: "MONDAY", exercises: [{ exerciseId: "12", targetSets: "4", targetRepetitions: "8", targetWeightKg: "20", notes: "", }] }] });
  assert.equal(payload.days[0].dayOfWeek, undefined);
  assert.deepEqual(payload.days[0].exercises[0], { exerciseId: 12, position: 0 });
});

test("serializa la ejecución por tiempo y no mezcla objetivos del plan", () => {
  const time = sessionPayload({ date: "2026-08-26", planId: "", planDayId: "", title: "", durationMinutes: 30, notes: "", exercises: [{ exerciseId: "12", targetSets: 3, targetSeconds: 30, targetWeightKg: 20, registrationType: "TIME", notes: "", sets: [{ seconds: 30, weightKg: 20 }] }] }, "CALISTHENICS");
  assert.deepEqual(time.exercises[0].sets[0], { setNumber: 1, seconds: 30, completed: false, notes: null });
  assert.equal("targetSets" in time.exercises[0], false);
  assert.equal("targetWeightKg" in time.exercises[0], false);
});

test("no crea series fake a partir de objetivos y conserva versión y origen", () => {
  const session = normalizeSession({ status: "IN_PROGRESS", version: 7, exercises: [{ id: 4, exerciseId: 12, targetSets: 4, targetRepetitions: 8, sourcePlanExerciseId: 99, origin: "PLAN", sets: [] }] });
  assert.equal(session.version, 7);
  assert.equal(session.exercises[0].sets.length, 0);
  assert.equal(session.exercises[0].sourcePlanExerciseId, 99);
  assert.equal(sessionStatusLabel("IN_PROGRESS"), "En proceso");
});

test("serializa un registro de caminadora en minutos y conserva la inclinación", () => {
  const payload = cardioPayload({ recordedAt: "2026-08-26T08:30", distanceKm: "4.50", durationMinutes: "35", inclined: true });
  assert.equal(payload.equipment, "TREADMILL");
  assert.equal(payload.distanceKm, 4.5);
  assert.equal(payload.durationMinutes, 35);
  assert.equal(payload.inclined, true);
  assert.equal(new Date(payload.recordedAt).getTime(), new Date("2026-08-26T08:30").getTime());
});

test("calcula el progreso y formatea el contador de service", () => {
  assert.equal(formatCardioMinutes(125), "2 h 5 min");
  assert.equal(cardioProgress({ totalDurationMinutes: 600, thresholdMinutes: 1200 }), 50);
  assert.equal(cardioProgress({ totalDurationMinutes: 1400, thresholdMinutes: 1200 }), 100);
});
