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
      profile = { ...profile, ...request.postDataJSON(), dailyCalorieGoal: 2140, goalOrigin: "SCHEDULED", nutritionPlanName: "Plan vigente" };
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
  await page.addInitScript(() => history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "profile" }, ""));
  await page.goto("/ingresar");
  await expect(page.getByLabel("Altura (cm)")).toBeVisible();

  const height = page.getByLabel("Altura (cm)");
  await expect(height).toHaveValue("175");
  await height.fill("182.5");
  const request = page.waitForRequest((value) => value.method() === "PATCH" && new URL(value.url()).pathname === "/api/profile");
  await page.getByRole("button", { name: "Guardar altura", exact: true }).click();

  expect((await request).postDataJSON()).toEqual({ heightCm: 182.5 });
  await expect(height).toHaveValue("182.5");
  await expect(page.getByText("2.140 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText(/Plan programado: Plan vigente/)).toBeVisible();
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
  await expect(dialog.getByRole("button", { name: "Guardar alternativa", exact: true })).toBeVisible();
  const editable = dialog.locator(".nutrition-plan-dialog-body input").first();
  await editable.focus();
  await page.setViewportSize({ width: 320, height: 430 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect.poll(() => editable.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const footer = element.closest(".nutrition-plan-dialog").querySelector(":scope > .modal-shell-footer").getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= footer.top + 1 && footer.bottom <= (window.visualViewport?.height || window.innerHeight) + 1;
  })).toBe(true);
  await expect(dialog.getByRole("button", { name: "Guardar alternativa", exact: true })).toBeVisible();
});


test("SG003/039 permite porcentajes transitorios y exige confirmar el impacto", async ({ page }) => {
  await seedProfileApp(page);
  let plans = []; let saves = 0; let confirmations = 0;
  await page.route("**/api/profile/nutrition-plans**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    let body = plans;
    if (request.method() === "POST" && path.endsWith("/nutrition-plans")) {
      saves++; const payload = request.postDataJSON();
      expect(payload.status).toBe("ALTERNATIVE");
      body = { ...payload, id: 81, version: 0, current: false }; plans = [body];
    } else if (path.endsWith("/schedule-preview")) body = { before: [], after: [{ ...plans[0], effectiveEndDate: null }], previewToken: "review-1" };
    else if (path.endsWith("/schedule")) {
      expect(request.postDataJSON()).toEqual({ version: 0, previewToken: "review-1" }); confirmations++;
      body = { ...plans[0], status: "SCHEDULED", current: true, version: 1 }; plans = [body];
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.addInitScript(() => history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "plans" }, ""));
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Agregar plan", exact: true }).click();
  await page.getByLabel("Proteínas (%)", { exact: true }).fill("35");
  await expect(page.getByRole("button", { name: "Guardar alternativa", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Proteínas (%)", { exact: true })).toHaveValue("35");
  await expect(page.getByLabel("Carbohidratos (%)", { exact: true })).toHaveValue("50");
  await page.getByLabel("Carbohidratos (%)", { exact: true }).fill("40");
  await page.getByRole("radio", { name: "Guardar y revisar programación", exact: true }).check();
  await page.getByRole("button", { name: "Guardar y revisar programación", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revisar programación" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Antes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Después", exact: true })).toBeVisible();
  expect(saves).toBe(1); expect(confirmations).toBe(0);
  await page.getByRole("button", { name: "Confirmar programación", exact: true }).click();
  await expect(page.getByText("Plan programado.", { exact: true })).toBeVisible();
  expect(confirmations).toBe(1);
});

test("SG035 shows one available count and manual alternative when exhausted", async ({page}) => {
  await seedProfileApp(page);
  await page.route("**/api/nutrition/ai-estimates/usage",route=>route.fulfill({json:{available:true,used:2,dailyLimit:5,status:"Usaste 2 de 5"}}));
  await page.goto("/nutricion/perfil");
  const quota=page.locator(".ai-usage-panel");
  await expect(quota).toContainText("3 estimaciones disponibles hoy");
  await expect(quota).not.toContainText("Usaste");
  await expect(quota.getByRole("link",{name:"Registrar con foto"})).toHaveAttribute("href","/nutricion/registrar");
  await page.route("**/api/nutrition/ai-estimates/usage",route=>route.fulfill({json:{available:true,used:5,dailyLimit:5}}));
  await page.reload(); await expect(quota).toContainText("Agotaste");
  await expect(quota.getByRole("link",{name:"Registrar manualmente"})).toBeVisible();
});
