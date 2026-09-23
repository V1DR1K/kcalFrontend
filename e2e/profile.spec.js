import { test, expect } from "@playwright/test";

async function seedProfileApp(page, { withPlanHistory = false } = {}) {
  let profile = { id: 1, fullName: "Persona Perfil", email: "perfil@example.com", weightKg: 70, heightCm: 175, dailyCalorieGoal: 2200 };
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};
    if (url.pathname === "/api/auth/me") body = { id: 1, fullName: "Persona Perfil", email: "perfil@example.com" };
    if (url.pathname === "/api/profile" && request.method() === "PATCH") {
      profile = { ...profile, ...request.postDataJSON() };
      body = profile;
    } else if (url.pathname === "/api/profile") body = profile;
    if (url.pathname === "/api/profile/weight-entries") body = [];
    if (url.pathname === "/api/profile/nutrition-plans") body = withPlanHistory ? [{ id: 8, name: "Plan de invierno", dailyCalories: 2140, proteinPercent: 25, carbsPercent: 50, fatPercent: 25, startDate: "2026-08-01", endDate: "2026-08-31", current: false }] : [];
    if (url.pathname === "/api/nutrition/ai-estimates/usage") body = { available: false };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("permite modificar la altura desde Perfil", async ({ page }) => {
  await seedProfileApp(page);
  await page.goto("/ingresar");
  await expect(page.getByRole("button", { name: "Salir", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Perfil", exact: true }).first().click();

  const height = page.getByLabel("Altura (cm)");
  await expect(height).toHaveValue("175");
  await height.fill("182.5");
  const request = page.waitForRequest((value) => value.method() === "PATCH" && new URL(value.url()).pathname === "/api/profile");
  await page.getByRole("button", { name: "Guardar altura", exact: true }).click();

  expect((await request).postDataJSON()).toEqual({ heightCm: 182.5 });
  await expect(height).toHaveValue("182.5");
  await expect(page.getByText("Altura actualizada.", { exact: true })).toBeVisible();
});

test("muestra fechas y macros legibles, con acciones del plan accesibles en un móvil bajo", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seedProfileApp(page, { withPlanHistory: true });
  await page.addInitScript(() => history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "plans" }, ""));
  await page.goto("/ingresar");

  const card = page.locator(".plan-history-card");
  await expect(card).toContainText("Plan de invierno");
  await expect(card).toContainText("1 de ago de 2026");
  await expect(card).toContainText("31 de ago de 2026");
  await expect(card).toContainText("25% proteína · 50% carbohidratos · 25% grasas");
  await expect(card).not.toContainText("2026-08-01");
  const cardBounds = await card.evaluate((element) => ({ right: element.getBoundingClientRect().right, width: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(cardBounds.right).toBeLessThanOrEqual(321);
  expect(cardBounds.width).toBeLessThanOrEqual(cardBounds.clientWidth + 1);
  await page.getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.locator(".nutrition-plan-dialog");
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const body = element.querySelector(".nutrition-plan-dialog-body");
    const footer = element.querySelector(":scope > .modal-shell-footer");
    return { bodyHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight, footerBottom: footer.getBoundingClientRect().bottom, viewportHeight: window.visualViewport?.height || window.innerHeight, horizontalOverflow: element.scrollWidth > element.clientWidth };
  });
  expect(layout.bodyScrollHeight).toBeGreaterThan(layout.bodyHeight);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.horizontalOverflow).toBe(false);
  await expect(dialog.getByRole("button", { name: "Crear plan", exact: true })).toBeVisible();
  const editable = dialog.locator(".nutrition-plan-dialog-body input").first();
  await editable.focus();
  await page.setViewportSize({ width: 320, height: 430 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect.poll(() => editable.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const footer = element.closest(".nutrition-plan-dialog").querySelector(":scope > .modal-shell-footer").getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= footer.top + 1 && footer.bottom <= (window.visualViewport?.height || window.innerHeight) + 1;
  })).toBe(true);
  await expect(dialog.getByRole("button", { name: "Crear plan", exact: true })).toBeVisible();
});
