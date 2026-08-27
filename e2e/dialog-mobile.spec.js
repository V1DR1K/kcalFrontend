import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page, { aiAvailable = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/auth/me")) body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    if (url.includes("/nutrition/dashboard")) body = { date: "2026-08-25", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals: [{ mealType: "BREAKFAST", items: [] }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }], waterConsumed: 0, waterGoal: 2, plan: null };
    if (url.includes("/nutrition/meal-types")) body = [{ code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" }, { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" }];
    if (url.includes("/nutrition/day-presets")) body = [];
    if (url.includes("/nutrition/ai-estimates/usage")) body = { available: aiAvailable };
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

test("keeps photo actions in one compact mobile row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByText("Elegir foto", { exact: true }).waitFor();

  const layout = await page.locator(".picker-photo-actions").evaluate((element) => {
    const buttons = [...element.querySelectorAll(".ai-photo-trigger")].map((trigger) => {
      const rect = trigger.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
    return { display: getComputedStyle(element).display, paddingLeft: parseFloat(getComputedStyle(element.closest(".picker-modal")).paddingLeft), buttons };
  });
  expect(layout.display).toBe("grid");
  expect(layout.paddingLeft).toBeGreaterThanOrEqual(12);
  expect(layout.buttons).toHaveLength(2);
  expect(layout.buttons[1].top).toBe(layout.buttons[0].top);
  expect(layout.buttons[0].height).toBeGreaterThanOrEqual(48);
});

test("keeps the food picker rows and scroll owner stable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();

  await expect(page.locator(".catalog-status").first()).toBeVisible();
  const layout = await page.locator(".picker-modal").evaluate((modal) => {
    const getRect = (selector) => modal.querySelector(selector)?.getBoundingClientRect().toJSON();
    const tabs = getRect(".picker-tabs");
    const tools = getRect(".picker-tools");
    const scroll = getRect(".picker-scroll");
    const status = getRect(".picker-scroll > .catalog-status");
    const pickerScroll = getComputedStyle(modal.querySelector(".picker-scroll"));
    return {
      rows: getComputedStyle(modal).gridTemplateRows.split(" ").length,
      tabs,
      tools,
      scroll,
      status,
      overflowY: pickerScroll.overflowY,
      statusOrder: getComputedStyle(modal.querySelector(".picker-scroll > .catalog-status")).order,
    };
  });

  expect(layout.rows).toBe(5);
  expect(layout.tabs.height).toBeLessThan(60);
  expect(layout.status.top).toBeGreaterThanOrEqual(layout.scroll.top);
  expect(layout.status.bottom).toBeLessThanOrEqual(layout.scroll.bottom);
  expect(layout.tools.bottom).toBeLessThanOrEqual(layout.scroll.top);
  expect(layout.overflowY).toBe("auto");
  expect(layout.statusOrder).toBe("-1");
});

test("keeps the AI description textarea at a non-zooming size on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator(".ai-gallery-trigger input").setInputFiles({
    name: "comida.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("test-image"),
  });

  const textarea = page.locator(".ai-context-field textarea").first();
  await expect(textarea).toBeVisible();
  await textarea.focus();
  await expect(textarea).toHaveCSS("font-size", "16px");
});
