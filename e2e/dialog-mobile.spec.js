import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem("scalegrams.token", "e2e-token");
    localStorage.setItem("scalegrams.user", JSON.stringify({ id: 1, fullName: "Persona E2E", email: "e2e@example.com" }));
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/nutrition/dashboard")) body = { date: "2026-08-25", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals: [], waterConsumed: 0, waterGoal: 2, plan: null };
    if (url.includes("/nutrition/meal-types")) body = [];
    if (url.includes("/nutrition/day-presets")) body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("keeps the scanner form inside a reduced mobile visual viewport", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.getByRole("button", { name: /Escanear código de barras/i }).click();
  await page.getByRole("button", { name: "Código manual" }).click();
  await page.locator("#manual-barcode").fill("7791234567890");
  await page.setViewportSize({ width: 402, height: 430 });

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const bounds = await page.locator(".scanner-result").evaluate((element) => element.getBoundingClientRect().toJSON());
  const inputBounds = await page.locator("#manual-barcode").evaluate((element) => element.getBoundingClientRect().toJSON());
  expect(bounds.bottom).toBeLessThanOrEqual(viewportHeight + 1);
  expect(inputBounds.bottom).toBeLessThanOrEqual(viewportHeight + 1);
  await expect(page.locator(".scanner-result")).toHaveCSS("overflow-y", "auto");
});
