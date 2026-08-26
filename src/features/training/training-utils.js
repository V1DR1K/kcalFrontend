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
  const type = source.type || source.module || source.trainingType || "GYM";
  return {
    id: source.id,
    type: type === "CALISTHENICS" ? "CALISTHENICS" : "GYM",
    date: source.sessionDate || source.date || dateKey(),
    routineId: source.routineId || source.routine?.id || "",
    routineName: source.routineName || source.routine?.name || "Sesión libre",
    durationMinutes: Number(source.durationMinutes || source.duration || 0),
    notes: source.notes || "",
    exercises: (source.exercises || []).map((exercise, index) => ({
      id: exercise.id || `exercise-${index}`,
      exerciseId: exercise.exerciseId || exercise.exercise?.id || "",
      name: exercise.name || exercise.exerciseName || exercise.exercise?.name || "Ejercicio",
      notes: exercise.notes || "",
      sets: (exercise.sets || []).map((set, setIndex) => ({
        id: set.id || `set-${setIndex}`,
        reps: set.reps ?? "",
        weightKg: set.weightKg ?? set.weight ?? "",
      })),
    })),
  };
}

export function createSessionDraft(type = "GYM", source = {}) {
  const session = normalizeSession({ ...source, type });
  const exercises = session.exercises.length ? session.exercises : [{ id: crypto.randomUUID?.() || Math.random().toString(36), exerciseId: "", name: "", notes: "", sets: [] }];
  return { ...session, exercises: exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.length ? exercise.sets : [{ id: crypto.randomUUID?.() || Math.random().toString(36), reps: "", weightKg: "" }] })) };
}

export function sessionPayload(draft, type) {
  const isGym = type === "GYM";
  return {
    type,
    sessionDate: draft.date,
    routineId: draft.routineId || null,
    durationMinutes: Number(draft.durationMinutes || 0) || null,
    notes: draft.notes.trim() || null,
    exercises: draft.exercises.map((exercise, position) => ({
      exerciseId: exercise.exerciseId || null,
      name: exercise.name.trim(),
      notes: exercise.notes.trim() || null,
      position,
      sets: exercise.sets.map((set, setPosition) => ({
        reps: Number(set.reps || 0),
        position: setPosition,
        ...(isGym ? { weightKg: Number(set.weightKg || 0) } : {}),
      })),
    })),
  };
}

export function routinePayload(routine) {
  return {
    name: routine.name.trim(),
    module: routine.module,
    active: Boolean(routine.active),
    days: (routine.days || []).map((day, position) => ({
      name: day.name.trim() || `Día ${position + 1}`,
      position,
      exercises: (day.exercises || []).map((exercise, exercisePosition) => ({
        exerciseId: exercise.exerciseId || null,
        name: exercise.name.trim(),
        sets: Number(exercise.sets || 0),
        reps: Number(exercise.reps || 0),
        position: exercisePosition,
      })),
    })),
  };
}

export function exercisePayload(exercise) {
  return { name: exercise.name.trim(), module: exercise.module, notes: exercise.notes.trim() || null };
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function sessionsForCalendar(data) {
  const source = data?.sessions || data?.days || [];
  return source.flatMap((entry) => (entry.sessions || [entry]).map((session) => ({ ...session, date: session.date || session.sessionDate || entry.date }))).map(normalizeSession);
}
