export const TRAINING_MODULES = [
  { value: "ALL", label: "Todos los módulos" },
  { value: "GYM", label: "Gimnasio" },
  { value: "CALISTHENICS", label: "Calistenia" },
];

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthDays(value) {
  const month = new Date(value.getFullYear(), value.getMonth(), 1);
  const leading = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: leading + count }, (_, index) => index < leading ? null : dateKey(new Date(month.getFullYear(), month.getMonth(), index - leading + 1)));
}

export function moduleLabel(value) {
  return TRAINING_MODULES.find((item) => item.value === value)?.label || "Entrenamiento";
}

export function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return "Sin duración";
  return value >= 60 ? `${Math.floor(value / 60)} h ${value % 60 ? `${value % 60} min` : ""}`.trim() : `${value} min`;
}

export function normalizeSession(source = {}) {
  const type = source.module || "GYM";
  return {
    id: source.id,
    type: type === "CALISTHENICS" ? "CALISTHENICS" : "GYM",
    date: source.date || dateKey(),
    planId: source.planId || "",
    planDayId: source.planDayId || "",
    planName: source.planName || "",
    planDayName: source.planDayName || "",
    title: source.title || source.planDayName || source.planName || "Sesión libre",
    status: source.status || "STARTED",
    startedAt: source.startedAt || null,
    finishedAt: source.finishedAt || null,
    durationMinutes: Number(source.durationMinutes || source.duration || 0),
    notes: source.notes || "",
    exercises: (source.exercises || []).map((exercise, index) => ({
      id: exercise.id || `exercise-${index}`,
      exerciseId: exercise.exerciseId || exercise.exercise?.id || "",
      name: exercise.name || exercise.exerciseName || exercise.exercise?.name || "Ejercicio",
      targetSets: exercise.targetSets ?? "",
      targetRepetitions: exercise.targetRepetitions ?? "",
      targetWeightKg: exercise.targetWeightKg ?? "",
      notes: exercise.notes || "",
      sets: (exercise.sets?.length ? exercise.sets : Array.from({ length: Number(exercise.targetSets || 0) }, (_, setIndex) => ({
        id: `set-${setIndex}`,
        reps: exercise.targetRepetitions ?? "",
        weightKg: exercise.targetWeightKg ?? "",
        completed: false,
      }))).map((set, setIndex) => ({
        id: set.id || `set-${setIndex}`,
        reps: set.reps ?? set.repetitions ?? "",
        weightKg: set.weightKg ?? set.weight ?? "",
        completed: Boolean(set.completed),
        notes: set.notes || "",
      })),
    })),
  };
}

export function createSessionDraft(type = "GYM", source = {}) {
  const session = normalizeSession({ ...source, module: type });
  const exercises = session.exercises.length ? session.exercises : [{ id: crypto.randomUUID?.() || Math.random().toString(36), exerciseId: "", name: "", notes: "", targetSets: "", targetRepetitions: "", targetWeightKg: "", sets: [] }];
  return { ...session, exercises: exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.length ? exercise.sets : [{ id: crypto.randomUUID?.() || Math.random().toString(36), reps: "", weightKg: "" }] })) };
}

export function sessionPayload(draft, type) {
  const isGym = type === "GYM";
  return {
    date: draft.date,
    module: type,
    planId: draft.planId ? Number(draft.planId) : null,
    planDayId: draft.planDayId ? Number(draft.planDayId) : null,
    title: draft.title?.trim() || draft.planDayName?.trim() || null,
    status: draft.status || "STARTED",
    startedAt: draft.startedAt || null,
    finishedAt: draft.finishedAt || null,
    durationMinutes: Number(draft.durationMinutes || 0) || null,
    notes: draft.notes.trim() || null,
    exercises: draft.exercises.map((exercise, position) => ({
      exerciseId: exercise.exerciseId ? Number(exercise.exerciseId) : null,
      targetSets: Number(exercise.targetSets || 0) || null,
      targetRepetitions: Number(exercise.targetRepetitions || 0) || null,
      ...(isGym && exercise.targetWeightKg !== "" && exercise.targetWeightKg != null ? { targetWeightKg: Number(exercise.targetWeightKg) } : {}),
      notes: exercise.notes.trim() || null,
      sets: exercise.sets.map((set, setPosition) => ({
        setNumber: setPosition + 1,
        repetitions: Number(set.reps || 0),
        ...(isGym && set.weightKg !== "" && set.weightKg != null ? { weightKg: Number(set.weightKg) } : {}),
        completed: Boolean(set.completed),
        notes: set.notes?.trim() || null,
      })),
    })),
  };
}

export function planPayload(plan) {
  return {
    name: plan.name.trim(),
    description: plan.description?.trim() || null,
    module: plan.module,
    frequencyMode: plan.frequencyMode,
    targetSessionsPerWeek: Number(plan.targetSessionsPerWeek),
    startDate: plan.startDate || null,
    endDate: plan.endDate || null,
    active: Boolean(plan.active),
    days: (plan.days || []).map((day, position) => ({
      name: day.name.trim() || `Día ${position + 1}`,
      description: day.description?.trim() || null,
      ...(plan.frequencyMode === "FIXED" ? { dayOfWeek: day.dayOfWeek } : {}),
      position,
      exercises: (day.exercises || []).map((exercise, exercisePosition) => ({
        exerciseId: Number(exercise.exerciseId),
        targetSets: Number(exercise.targetSets),
        targetRepetitions: Number(exercise.targetRepetitions),
        ...(plan.module === "GYM" && exercise.targetWeightKg !== "" && exercise.targetWeightKg != null ? { targetWeightKg: Number(exercise.targetWeightKg) } : {}),
        notes: exercise.notes?.trim() || null,
        position: exercisePosition,
      })),
    })),
  };
}

export function exercisePayload(exercise) {
  return { name: exercise.name.trim(), description: exercise.description?.trim() || null, category: exercise.category?.trim() || null, module: exercise.module, active: exercise.active !== false };
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function sessionsForCalendar(data) {
  const source = Array.isArray(data) ? data : data?.days || data?.sessions || [];
  return source.flatMap((entry) => (entry.sessions || []).map((session) => ({ ...session, date: session.date || entry.date }))).map(normalizeSession);
}
