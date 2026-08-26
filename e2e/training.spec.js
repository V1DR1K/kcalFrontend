import { test, expect } from "@playwright/test";

async function seedTrainingApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem("scalegrams.token", "training-e2e-token");
    localStorage.setItem("scalegrams.user", JSON.stringify({ id: 1, fullName: "Persona E2E" }));
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/training/dashboard")) body = { routines: [{ id: "r-1", name: "Fuerza base", module: "GYM", dayCount: 3, exerciseCount: 8 }], recentSession: { id: "s-1", type: "GYM", date: "2026-08-26", routineName: "Fuerza base", durationMinutes: 45, exercises: [{ name: "Sentadilla", sets: [{ reps: 5, weightKg: 80 }] }] }, weeklySummary: { sessions: 2, totalMinutes: 90, totalSets: 18 } };
    if (url.includes("/api/training/calendar")) body = { sessions: [{ id: "s-1", type: "GYM", date: "2026-08-26", routineName: "Fuerza base", durationMinutes: 45, exercises: [{ name: "Sentadilla", sets: [{ reps: 5, weightKg: 80 }] }] }] };
    if (url.includes("/api/training/routines")) body = [{ id: "r-1", name: "Fuerza base", module: "GYM", active: true, days: [] }];
    if (url.includes("/api/training/exercises")) body = [{ id: "e-1", name: "Sentadilla", module: "GYM", preset: true }];
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
  await expect(page.getByRole("heading", { name: "Entrenamiento", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nutrición", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mis ejercicios", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Nutrición", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Mi día", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Entrenamiento", exact: true })).toBeVisible();
});

test("opens a gym session editor from the training dashboard", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrenamiento", exact: true }).first().click();
  await page.getByRole("button", { name: "Iniciar gimnasio", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Nueva sesión de gimnasio/i })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)").first()).toBeVisible();
});
