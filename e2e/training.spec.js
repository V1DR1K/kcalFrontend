import { test, expect } from "@playwright/test";

async function seedTrainingApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem("scalegrams.token", "training-e2e-token");
    localStorage.setItem("scalegrams.user", JSON.stringify({ id: 1, fullName: "Persona E2E" }));
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/training/dashboard")) body = { date: "2026-08-26", plans: [{ id: 1, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, active: true }], recentSession: { id: 1, module: "GYM", date: "2026-08-26", title: "Fuerza base", durationMinutes: 45, exercises: [{ exerciseName: "Sentadilla", sets: [{ repetitions: 5, weightKg: 80 }] }] }, weeklySummary: { sessionCount: 2, totalMinutes: 90, totalSets: 18 }, exercises: [{ id: 1, name: "Sentadilla", module: "GYM", global: true, editable: false, active: true }], plannedPlans: [] };
    if (url.includes("/api/training/calendar")) body = [];
    if (url.includes("/api/training/categories")) body = { items: [{ id: 10, name: "Piernas", module: "GYM", system: true, editable: false, active: true }], page: 0, size: 100, totalElements: 1, totalPages: 1, hasNext: false };
    if (url.includes("/api/training/exercises")) body = { items: [{ id: 1, name: "Sentadilla", module: "GYM", category: "Piernas", categoryId: 10, registrationType: "REPETITIONS", equipment: "BARBELL", global: true, systemExercise: true, editable: false, active: true }], page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
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
  await expect(page.getByRole("heading", { name: /Nueva sesión de gimnasio/i })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)").first()).toBeVisible();
});

test("keeps a long plan scrollable and does not show plan descriptions", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Perfil", exact: true }).first().click();
  await page.getByRole("button", { name: "Agregar plan", exact: true }).click();
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
  await page.getByRole("button", { name: "Perfil", exact: true }).first().click();
  await page.getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  const picker = dialog.getByRole("combobox", { name: "Ejercicio persistido" });
  await picker.fill("Sentadilla");
  await expect(dialog.getByRole("option", { name: /Sentadilla.*Base/ })).toBeVisible();
  await dialog.getByRole("option", { name: /Sentadilla.*Base/ }).click();
  await expect(dialog.getByText(/Sentadilla/).last()).toBeVisible();
});

test("does not render weight fields for calisthenics", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Iniciar calistenia", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Nueva sesión de calistenia/i })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
  await expect(page.getByLabel("Repeticiones").first()).toBeVisible();
});
