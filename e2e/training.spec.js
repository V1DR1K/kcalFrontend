import { test, expect } from "@playwright/test";

async function seedTrainingApp(page, { planned = false, exerciseOnSecondPage = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/auth/me")) body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    if (url.includes("/api/training/dashboard")) body = { date: "2026-08-26", plans: [{ id: 1, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, active: true }], recentSession: { id: 1, module: "GYM", date: "2026-08-26", title: "Fuerza base", durationMinutes: 45, exercises: [{ exerciseName: "Sentadilla", sets: [{ repetitions: 5, weightKg: 80 }] }] }, weeklySummary: { sessionCount: 2, totalMinutes: 90, totalSets: 18 }, exercises: [{ id: 1, name: "Sentadilla", module: "GYM", global: true, editable: false, active: true }], plannedPlans: planned ? [{ planId: 1, planDayId: 11, module: "GYM", planDayName: "Fuerza", recommended: true }] : [] };
    if (url.includes("/api/training/calendar")) body = [];
    if (url.endsWith("/api/training/sessions")) body = { id: 20, version: 1, status: "IN_PROGRESS", module: "GYM", date: "2026-08-26", exercises: [] };
    if (url.includes("/api/training/sessions/20/complete")) body = { id: 20, version: 2, status: "COMPLETED", module: "GYM", date: "2026-08-26", exercises: [] };
    if (url.includes("/api/training/plans/1")) body = { id: 1, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, days: [{ id: 11, name: "Fuerza", dayOfWeek: "WEDNESDAY", exercises: [{ id: 101, exerciseId: 1, exerciseName: "Sentadilla", targetSets: 4, targetRepetitions: 5, targetWeightKg: 80 }] }] };
    if (url.includes("/api/training/categories")) body = { items: [{ id: 10, name: "Piernas", module: "GYM", system: true, editable: false, active: true }], page: 0, size: 100, totalElements: 1, totalPages: 1, hasNext: false };
    if (url.includes("/api/training/exercises")) {
      const pageNumber = Number(new URL(url).searchParams.get("page") || 0);
      const pagedItems = pageNumber === 0
        ? [{ id: 1, name: "Sentadilla", module: "GYM", category: "Piernas", categoryId: 10, registrationType: "REPETITIONS", equipment: "BARBELL", global: true, systemExercise: true, editable: false, active: true }]
        : [{ id: 2, name: "Remo persistido", module: "GYM", category: "Espalda", categoryId: 10, registrationType: "REPETITIONS", equipment: "BARBELL", global: false, systemExercise: false, editable: true, active: true }];
      body = exerciseOnSecondPage ? { items: pagedItems, page: pageNumber, size: 50, totalElements: 2, totalPages: 2, hasNext: pageNumber === 0 } : { items: pagedItems.slice(0, 1), page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
    }
    if (url.endsWith("/api/profile")) body = { id: 1, fullName: "Persona E2E", weightKg: 70, heightCm: 175, dailyCalorieGoal: 2200 };
    if (url.includes("/nutrition/dashboard")) body = { date: "2026-08-26", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals: [], waterConsumed: 0, waterGoal: 2, plan: null };
    if (url.includes("/nutrition/meal-types")) body = [];
    if (url.includes("/nutrition/day-presets")) body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("swaps the nutrition shell for training and restores nutrition with browser history", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Día", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nutrición", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ejercicios", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver calendario", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Nutrición", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Día", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Día", exact: true })).toBeVisible();
});

test("opens a gym session editor from the training dashboard", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Iniciar gimnasio", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Editar gimnasio/i })).toBeVisible();
  await expect(page.getByText("Autoguardado activo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
});

test("creates a planned session before opening it and can finish it", async ({ page }) => {
  await seedTrainingApp(page, { planned: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  const createRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/training/sessions"));
  await page.getByRole("button", { name: "Iniciar día", exact: true }).click();
  expect((await createRequest).postDataJSON()).toEqual({ date: "2026-08-26", module: "GYM", planId: 1, planDayId: 11 });
  await expect(page.getByRole("heading", { name: /Editar gimnasio/i })).toBeVisible();
  await expect(page.getByText("Sentadilla", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
  const completeRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/complete"));
  await page.getByRole("button", { name: "Finalizar día", exact: true }).click();
  await expect((await completeRequest).postDataJSON()).toEqual({ version: 1, persistPlanChanges: false });
});

test("keeps a long plan scrollable and does not show plan descriptions", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Planes", exact: true }).first().click();
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nuevo plan", exact: true })).toBeVisible();
  await expect(dialog.getByText("Descripción", { exact: true })).toHaveCount(0);
  for (let index = 0; index < 8; index += 1) await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await expect.poll(() => dialog.locator(".modal-shell-content").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test("uses persisted categories and a searchable persisted exercise selector", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Ejercicios", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Categorías", exact: true })).toBeVisible();
  await expect(page.getByText("Piernas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Planes", exact: true }).first().click();
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Día 1", exact: true })).toBeVisible();
  const picker = dialog.getByRole("combobox", { name: "Buscar ejercicio" });
  await picker.fill("Sentadilla");
  await expect(page.getByRole("option", { name: /Sentadilla.*Base/ })).toBeVisible();
  await page.getByRole("option", { name: /Sentadilla.*Base/ }).click();
  await expect(dialog.locator(".training-plan-exercise-copy").getByText("Sentadilla", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Volver al plan", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Nuevo plan", exact: true })).toBeVisible();
  await expect(dialog.locator(".training-plan-day-summary").getByText(/Sentadilla/)).toBeVisible();
});

test("loads every exercise page before filtering the plan day picker", async ({ page }) => {
  await seedTrainingApp(page, { exerciseOnSecondPage: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Planes", exact: true }).first().click();
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Buscar ejercicio" }).fill("Remo persistido");
  await expect(page.getByRole("option", { name: /Remo persistido.*Personal/ })).toBeVisible();
  await expect(dialog.getByText("Cargar más ejercicios", { exact: true })).toHaveCount(0);
});

test("shows only training plans in training mode", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Planes", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Planes de entrenamiento", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan alimenticio", exact: true })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/api/profile/nutrition-plans"))).toBe(false);
});

test("keeps training actions and exercise options inside a reduced mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /^(Entrenamiento|Entreno)$/ }).first().click();
  await page.getByRole("button", { name: "Planes", exact: true }).first().click();
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Buscar ejercicio" }).fill("Sentadilla");

  const option = page.getByRole("option", { name: /Sentadilla.*Base/ });
  await expect(option).toBeVisible();
  const bounds = await page.evaluate(() => {
    const getBounds = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      viewport: window.innerHeight,
      surface: getBounds("[data-dialog-surface=\"true\"]"),
      content: getBounds("[data-dialog-surface=\"true\"] > .modal-shell-content"),
      footer: getBounds("[data-dialog-surface=\"true\"] > .modal-shell-footer"),
      list: getBounds(".training-exercise-picker-results"),
      footerPosition: getComputedStyle(document.querySelector("[data-dialog-surface=\"true\"] > .modal-shell-footer")).position,
    };
  });
  expect(bounds.surface.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.footer.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.content.bottom).toBeGreaterThanOrEqual(bounds.footer.bottom - 1);
  expect(bounds.footerPosition).toBe("absolute");
  expect(bounds.list.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.list.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  await option.click();
});

test("does not render weight fields for calisthenics", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Iniciar calistenia", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Editar calistenia/i })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
  await expect(page.getByText("Agregá un ejercicio para comenzar la sesión.", { exact: true })).toBeVisible();
});
