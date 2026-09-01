import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page, { aiAvailable = false, withFoodLog = false, withPreset = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/auth/me")) body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    if (url.includes("/nutrition/dashboard")) {
      const meals = withFoodLog
        ? [{ mealType: "BREAKFAST", label: "Desayuno", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, items: [{ id: 101, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, food: { id: 11, name: "Avena", baseQuantity: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "OTHER" } }] }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }]
        : [{ mealType: "BREAKFAST", items: [] }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }];
      body = { date: "2026-08-25", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals, waterConsumed: 0, waterGoal: 2, plan: null };
    }
    if (url.includes("/nutrition/meal-types")) body = [{ code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" }, { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" }];
    if (url.includes("/nutrition/day-presets")) body = withPreset ? [{ id: 1, name: "Día completo", itemCount: 1, mealCounts: { BREAKFAST: 1 }, items: [{ itemType: "FOOD", itemId: 11, mealType: "BREAKFAST", quantity: 100, unit: "GRAM", displayName: "Avena", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7 }] }] : [];
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

test("opens the consumed quantity editor at the top on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");
  const meal = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  await meal.locator(".meal-item").press("Enter");
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThanOrEqual(1);

  const quantity = dialog.getByLabel("Cantidad");
  await quantity.focus();
  await quantity.fill("42,5");
  await expect(quantity).toHaveValue("42.5");
  await page.setViewportSize({ width: 390, height: 430 });
  const quantityBottom = await quantity.evaluate((element) => element.getBoundingClientRect().bottom);
  expect(quantityBottom).toBeLessThanOrEqual(430 + 1);
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

test("pins modal actions without taking a grid row on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();

  const layout = await page.locator(".picker-modal").evaluate((modal) => {
    const scroll = modal.querySelector(".picker-scroll").getBoundingClientRect();
    const footer = modal.querySelector(":scope > .modal-shell-footer, :scope > footer");
    const footerRect = footer.getBoundingClientRect();
    return {
      modal: modal.getBoundingClientRect().toJSON(),
      scroll,
      footer: footerRect.toJSON(),
      footerPosition: getComputedStyle(footer).position,
      rows: getComputedStyle(modal).gridTemplateRows.split(" ").length,
    };
  });

  expect(layout.footerPosition).toBe("absolute");
  expect(layout.rows).toBe(4);
  expect(layout.footer.bottom).toBeLessThanOrEqual(430 + 1);
  expect(layout.scroll.bottom).toBeLessThanOrEqual(layout.footer.bottom);
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
      overflowX: pickerScroll.overflowX,
      overflowY: pickerScroll.overflowY,
      hasHorizontalOverflow: modal.querySelector(".picker-scroll").scrollWidth > modal.querySelector(".picker-scroll").clientWidth,
      statusOrder: getComputedStyle(modal.querySelector(".picker-scroll > .catalog-status")).order,
    };
  });

  expect(layout.rows).toBe(4);
  expect(layout.tabs.height).toBeLessThan(60);
  expect(layout.status.top).toBeGreaterThanOrEqual(layout.scroll.top);
  expect(layout.status.bottom).toBeLessThanOrEqual(layout.scroll.bottom);
  expect(layout.tools.bottom).toBeLessThanOrEqual(layout.scroll.top);
  expect(layout.overflowX).toBe("hidden");
  expect(layout.overflowY).toBe("auto");
  expect(layout.hasHorizontalOverflow).toBe(false);
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

test("keeps the last preset action above the mobile close footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withPreset: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Abrir Reutilizá tu día" }).click();

  const modal = page.locator(".day-presets-modal");
  const lastCard = modal.locator(".day-preset-card").last();
  await lastCard.scrollIntoViewIfNeeded();
  const layout = await modal.evaluate((element) => {
    const card = element.querySelector(".day-preset-card:last-of-type");
    const action = card?.querySelector(".primary")?.getBoundingClientRect();
    const footer = element.querySelector(":scope > footer")?.getBoundingClientRect();
    return { actionBottom: action?.bottom, footerTop: footer?.top };
  });
  expect(layout.actionBottom).toBeLessThanOrEqual(layout.footerTop + 1);
});

test("shows only nutrition plans in nutrition mode", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Planes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan alimenticio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planes de entrenamiento", exact: true })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/api/training/plans"))).toBe(false);
});

test("keeps AI estimate actions in the editor flow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "Comida estimada", confidence: 86, description: "Una comida simple", assumptions: [], items: [{ name: "Avena", category: "OTHER", preparation: "UNSPECIFIED", estimatedGrams: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7 }] }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator(".ai-gallery-trigger input").setInputFiles({
    name: "comida.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Analizar foto", exact: true }).click();

  const editor = page.locator(".ai-estimate-editor");
  await expect(editor).toBeVisible();
  const actions = editor.locator(".ai-estimate-actions");
  const layout = await actions.evaluate((element) => {
    const refinement = element.previousElementSibling?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { position: getComputedStyle(element).position, top: rect.top, refinementBottom: refinement?.bottom || 0 };
  });
  expect(layout.position).toBe("static");
  expect(layout.top).toBeGreaterThanOrEqual(layout.refinementBottom - 1);
});
