import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function seedCardioApp(page, { withHeight = true } = {}) {
  await page.clock.install({ time: new Date("2026-09-08T12:00:00-03:00") });
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const requestUrl = request.url();
    const url = new URL(requestUrl);
    let body = {};
    if (requestUrl.includes("/api/auth/me")) body = { id: 1, fullName: "Persona Cardio", email: "cardio@example.com" };
    if (requestUrl.includes("/api/profile")) body = { id: 1, fullName: "Persona Cardio", heightCm: withHeight ? 180 : null, weightKg: 70, dailyCalorieGoal: 2200 };
    if (requestUrl.includes("/api/training/dashboard")) body = {
      date: "2026-09-07",
      plans: [],
      recentSession: null,
      weeklySummary: {
        sessionCount: 1,
        totalMinutes: 35,
        totalSets: 0,
        cardio: {
          from: "2026-09-02",
          to: "2026-09-08",
          totalDistanceKm: 4.958,
          totalEstimatedSteps: withHeight ? 6637 : null,
          stepsAvailable: withHeight,
          days: ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"].map((date, index) => ({ date, distanceKm: index === 5 ? 4.958 : 0, estimatedSteps: withHeight && index === 5 ? 6637 : null, sessionCount: index === 5 ? 1 : 0 })),
        },
      },
      exercises: [],
      plannedPlans: [],
    };
    if (requestUrl.includes("/api/training/cardio/summary")) body = {
      equipment: "TREADMILL",
      thresholdMinutes: 1200,
      totalDurationMinutes: 35,
      remainingMinutes: 1165,
      due: false,
      totalDistanceKm: 4.958,
      totalEstimatedSteps: withHeight ? 6637 : null,
      profileHeightCm: withHeight ? 180 : null,
      latestService: null,
    };
    if (requestUrl.includes("/api/training/cardio/weekly")) body = {
      from: "2026-09-02",
      to: "2026-09-08",
      totalDistanceKm: 4.958,
      totalEstimatedSteps: withHeight ? 6637 : null,
      stepsAvailable: withHeight,
      days: ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"].map((date, index) => ({ date, distanceKm: index === 5 ? 4.958 : 0, estimatedSteps: withHeight && index === 5 ? 6637 : null, sessionCount: index === 5 ? 1 : 0 })),
    };
    if (requestUrl.includes("/api/training/cardio?") || requestUrl.endsWith("/api/training/cardio")) body = {
      items: [{ id: 1, equipment: "TREADMILL", recordedAt: "2026-09-07T10:00:00Z", distanceKm: 4.958, durationMinutes: 35, inclined: true, speedKmh: 8.5, estimatedSteps: withHeight ? 6637 : null }],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    };
    if (request.method() === "POST" && url.pathname.endsWith("/api/training/cardio")) body = { id: 2, equipment: "TREADMILL", recordedAt: "2026-09-07T10:00:00Z", distanceKm: 4.958, durationMinutes: 35, inclined: true, speedKmh: 8.5, estimatedSteps: withHeight ? 6637 : null };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("muestra pasos por sesión y permite registrar velocidad con preview en móvil", async ({ page }) => {
  await seedCardioApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entreno", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Pasos de caminadora", exact: true })).toBeVisible();
  await expect(page.locator(".training-cardio-week-day")).toHaveCount(7);
  await page.getByRole("button", { name: "Cardio", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Historial de cardio", exact: true })).toBeVisible();
  await expect(page.getByText("~6.637 pasos estimados", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Registrar sesión", exact: true }).click();
  await page.getByLabel("Velocidad media (km/h)").fill("8,50");
  await page.getByLabel("Tiempo (minutos)").fill("35");
  await expect(page.getByText("4,958 km · ~6.637 pasos", { exact: true })).toBeVisible();
  const request = page.waitForRequest((value) => value.method() === "POST" && value.url().endsWith("/api/training/cardio"));
  await page.getByRole("button", { name: "Guardar registro", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ speedKmh: 8.5, durationMinutes: 35, inclined: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("explica la falta de altura sin inventar pasos", async ({ page }) => {
  await seedCardioApp(page, { withHeight: false });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entreno", exact: true }).first().click();
  await page.getByRole("button", { name: "Cardio", exact: true }).first().click();
  await expect(page.getByText("Pasos no disponibles", { exact: true })).toBeVisible();
  await expect(page.getByText("Completá tu altura en Perfil para estimar pasos").first()).toBeVisible();
});

test("mantiene Cardio sin desborde horizontal en anchos móviles", async ({ page }) => {
  await seedCardioApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entreno", exact: true }).first().click();
  await page.getByRole("button", { name: "Cardio", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Historial de cardio", exact: true })).toBeVisible();
  for (const width of [320, 390, 402, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
