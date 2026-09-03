export const TRAINING_MODULES = [
  { value: "ALL", label: "Todos los módulos" },
  { value: "GYM", label: "Gimnasio" },
  { value: "CALISTHENICS", label: "Calistenia" },
];

export const REGISTRATION_TYPES = [
  { value: "REPETITIONS", label: "Repeticiones" },
  { value: "WEIGHT_AND_REPETITIONS", label: "Peso y repeticiones" },
  { value: "REPETITIONS_AND_TIME", label: "Repeticiones + tiempo" },
  { value: "TIME", label: "Tiempo" },
  { value: "DISTANCE", label: "Distancia" },
];

export const EQUIPMENT_OPTIONS = [
  { value: "NONE", label: "Sin equipamiento" },
  { value: "BODYWEIGHT", label: "Peso corporal" },
  { value: "BARBELL", label: "Barra" },
  { value: "DUMBBELL", label: "Mancuernas" },
  { value: "KETTLEBELL", label: "Kettlebell" },
  { value: "CABLE", label: "Polea" },
  { value: "MACHINE", label: "Máquina" },
  { value: "SMITH_MACHINE", label: "Máquina Smith" },
  { value: "BENCH", label: "Banco" },
  { value: "PULL_UP_BAR", label: "Barra de dominadas" },
  { value: "PARALLEL_BARS", label: "Barras paralelas" },
  { value: "RINGS", label: "Anillas" },
  { value: "PARALLETTES", label: "Paralelas" },
  { value: "BAND", label: "Banda" },
  { value: "BOX", label: "Cajón" },
  { value: "AB_WHEEL", label: "Rueda abdominal" },
  { value: "HEX_BAR", label: "Barra hexagonal" },
  { value: "SLED", label: "Trineo" },
  { value: "ROWING_MACHINE", label: "Remo ergométrico" },
  { value: "AIR_BIKE", label: "Bicicleta de aire" },
  { value: "OTHER", label: "Otro" },
];

export const DIFFICULTY_OPTIONS = [
  { value: "BEGINNER", label: "Inicial" },
  { value: "INTERMEDIATE", label: "Intermedio" },
  { value: "ADVANCED", label: "Avanzado" },
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

export function registrationType(value, module = "GYM") {
  const aliases = { REPS: "REPETITIONS", REPETITION: "REPETITIONS", REPS_AND_TIME: "REPETITIONS_AND_TIME", SECONDS: "TIME", METERS: "DISTANCE" };
  value = aliases[value] || value;
  const known = REGISTRATION_TYPES.some((item) => item.value === value);
  if (known) return value;
  return module === "CALISTHENICS" ? "REPETITIONS" : "WEIGHT_AND_REPETITIONS";
}

export function registrationTypeLabel(value, module) {
  return REGISTRATION_TYPES.find((item) => item.value === registrationType(value, module))?.label || "Repeticiones";
}

export function sessionStatus(value) {
  return value === "STARTED" ? "IN_PROGRESS" : value || "IN_PROGRESS";
}

export function sessionStatusLabel(value) {
  return { IN_PROGRESS: "En proceso", COMPLETED: "Finalizado", CANCELLED: "Cancelado", SKIPPED: "Omitido" }[sessionStatus(value)] || "En proceso";
}

export function optionLabel(options, value, fallback = value) {
  return options.find((item) => item.value === value)?.label || fallback || "Sin especificar";
}

export function exerciseRegistration(exercise = {}, module) {
  return registrationType(exercise.registrationType, module || exercise.module);
}

export function formatExerciseTarget(exercise = {}, module) {
  const type = exerciseRegistration(exercise, module);
  const sets = exercise.targetSets || 0;
  if (type === "TIME") return `${sets}×${exercise.targetSeconds || 0} s`;
  if (type === "DISTANCE") return `${sets}×${exercise.targetDistanceMeters || 0} m`;
  if (type === "REPETITIONS_AND_TIME") return `${sets}×${exercise.targetRepetitions || 0} · ${exercise.targetSeconds || 0} s`;
  return `${sets}×${exercise.targetRepetitions || 0}${module === "GYM" && type === "WEIGHT_AND_REPETITIONS" && exercise.targetWeightKg != null && exercise.targetWeightKg !== "" ? ` · ${exercise.targetWeightKg} kg` : ""}`;
}

export function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return "Sin duración";
  return value >= 60 ? `${Math.floor(value / 60)} h ${value % 60 ? `${value % 60} min` : ""}`.trim() : `${value} min`;
}

export function formatTrainingDate(value) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
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
    status: sessionStatus(source.status || source.sessionStatus),
    version: source.version ?? null,
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
      targetSeconds: exercise.targetSeconds ?? "",
      targetDistanceMeters: exercise.targetDistanceMeters ?? "",
      targetWeightKg: exercise.targetWeightKg ?? "",
      registrationType: exerciseRegistration(exercise, type),
      unilateral: Boolean(exercise.unilateral || exercise.exercise?.unilateral),
      category: exercise.category || exercise.exercise?.category || "",
      categoryId: exercise.categoryId || exercise.exercise?.categoryId || "",
      sourcePlanExerciseId: exercise.sourcePlanExerciseId ?? null,
      origin: exercise.origin || null,
      notes: exercise.notes || "",
      sets: (exercise.sets || []).map((set, setIndex) => ({
        id: set.id || `set-${setIndex}`,
        reps: set.reps ?? set.repetitions ?? "",
        seconds: set.seconds ?? "",
        distanceMeters: set.distanceMeters ?? "",
        weightKg: set.weightKg ?? set.weight ?? "",
        side: set.side || set.laterality || "BOTH",
        completed: Boolean(set.completed),
        notes: set.notes || "",
      })),
    })),
  };
}

export function createSessionDraft(type = "GYM", source = {}) {
  const session = normalizeSession({ ...source, module: type });
  return { ...session, status: sessionStatus(session.status), exercises: session.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets || [] })) };
}

export function sessionPayload(draft, type) {
  return {
    date: draft.date,
    module: type,
    planId: draft.planId ? Number(draft.planId) : null,
    planDayId: draft.planDayId ? Number(draft.planDayId) : null,
    title: draft.title?.trim() || draft.planDayName?.trim() || null,
    status: sessionStatus(draft.status),
    ...(draft.version != null ? { version: draft.version } : {}),
    startedAt: draft.startedAt || null,
    finishedAt: draft.finishedAt || null,
    durationMinutes: Number(draft.durationMinutes || 0) || null,
    notes: draft.notes.trim() || null,
    exercises: draft.exercises.map((exercise, position) => ({
      exerciseId: exercise.exerciseId ? Number(exercise.exerciseId) : null,
      ...(Number.isInteger(Number(exercise.id)) ? { id: Number(exercise.id) } : {}),
      position,
      notes: (exercise.notes || "").trim() || null,
      sets: exercise.sets.map((set, setPosition) => ({
        setNumber: setPosition + 1,
        ...(exerciseRegistration(exercise, type) !== "TIME" && exerciseRegistration(exercise, type) !== "DISTANCE" ? { repetitions: set.reps === "" || set.reps == null ? null : Number(set.reps) } : {}),
        ...(exerciseRegistration(exercise, type) === "TIME" || exerciseRegistration(exercise, type) === "REPETITIONS_AND_TIME" ? { seconds: set.seconds === "" || set.seconds == null ? null : Number(set.seconds) } : {}),
        ...(exerciseRegistration(exercise, type) === "DISTANCE" ? { distanceMeters: set.distanceMeters === "" || set.distanceMeters == null ? null : Number(set.distanceMeters) } : {}),
        ...(type === "GYM" && exerciseRegistration(exercise, type) === "WEIGHT_AND_REPETITIONS" && set.weightKg !== "" && set.weightKg != null ? { weightKg: Number(set.weightKg) } : {}),
        ...(exercise.unilateral ? { side: set.side || "BOTH" } : {}),
        completed: Boolean(set.completed),
        notes: set.notes?.trim() || null,
      })),
    })),
  };
}

export function planPayload(plan) {
  return {
    ...(plan.version != null ? { version: plan.version } : {}),
    name: plan.name.trim(),
    module: plan.module,
    frequencyMode: plan.frequencyMode,
    targetSessionsPerWeek: Number(plan.targetSessionsPerWeek),
    startDate: plan.startDate || null,
    endDate: plan.endDate || null,
    active: Boolean(plan.active),
    days: (plan.days || []).map((day, position) => ({
      name: day.name.trim() || `Día ${position + 1}`,
      ...(plan.frequencyMode === "FIXED" ? { dayOfWeek: day.dayOfWeek } : {}),
      position,
      exercises: (day.exercises || []).map((exercise, exercisePosition) => ({
        exerciseId: Number(exercise.exerciseId),
        position: exercisePosition,
      })),
    })),
  };
}

export function exercisePayload(exercise) {
  return {
    name: exercise.name.trim(),
    description: exercise.description?.trim() || null,
    categoryId: exercise.categoryId ? Number(exercise.categoryId) : null,
    module: exercise.module,
    primaryMuscles: exercise.primaryMuscles?.trim() || null,
    secondaryMuscles: exercise.secondaryMuscles?.trim() || null,
    equipment: exercise.equipment || null,
    difficulty: exercise.difficulty || null,
    registrationType: registrationType(exercise.registrationType, exercise.module),
    unilateral: Boolean(exercise.unilateral),
    externalLoad: Boolean(exercise.externalLoad),
    active: exercise.active !== false,
  };
}

export function categoryPayload(category) {
  return { name: category.name.trim(), module: category.module, active: category.active !== false };
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
