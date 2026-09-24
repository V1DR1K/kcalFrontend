import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page, { presets = [], currentItems = [] } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
    history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "day-presets" }, "");
  });

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    let body = {};

    if (requestUrl.pathname === "/api/auth/me") {
      body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    } else if (requestUrl.pathname === "/api/nutrition/dashboard") {
      body = {
        date: requestUrl.searchParams.get("date"),
        caloriesConsumed: 0,
        calorieGoal: 2000,
        macros: [],
        meals: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"].map((mealType) => ({ mealType, items: mealType === "BREAKFAST" ? currentItems : [] })),
        nutrients: [],
        waterConsumed: 0,
        waterGoal: 2,
        plan: null,
      };
    } else if (requestUrl.pathname === "/api/nutrition/day-presets") {
      body = presets;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.describe("Reutilizá tu día responsive", () => {
  test("opens any saved day in a mobile dialog and returns to its card", async ({ page }, testInfo) => {
    test.skip(!["webkit-iphone", "webkit-ipad"].includes(testInfo.project.name), "Compact detail contract");
    const presets = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1, name: `Día guardado ${index + 1}`, description: `Comidas del día ${index + 1}`,
      itemCount: 1, mealCounts: { BREAKFAST: 1 },
      items: [{ itemType: "AI_ESTIMATE", displayName: `Desayuno ${index + 1}`, mealType: "BREAKFAST", quantity: 1, unit: "PORTION", calories: 300, proteinGrams: 12, carbsGrams: 24, fatGrams: 10 }],
    }));
    await seedAuthenticatedApp(page, { presets });
    await page.goto("/ingresar");
    const cards = page.locator(".day-preset-card-select");
    await expect(cards).toHaveCount(20);
    await expect(page.getByRole("dialog", { name: /Día guardado/ })).toHaveCount(0);
    await expect(page.locator(".abm-preview-panel")).toBeHidden();

    for (const index of [0, 19]) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const before = await page.locator(".content").evaluate((element) => element.scrollTop);
      await card.click();
      const dialog = page.getByRole("dialog", { name: `Día guardado ${index + 1}` });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(`Desayuno ${index + 1}`)).toBeVisible();
      const position = await dialog.evaluate((element) => element.getBoundingClientRect().toJSON());
      expect(position.top).toBeGreaterThanOrEqual(-1);
      expect(position.bottom).toBeLessThanOrEqual(page.viewportSize().height + 1);
      await dialog.getByRole("button", { name: "Cerrar" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(card).toBeFocused();
      await expect.poll(() => page.locator(".content").evaluate((element) => element.scrollTop)).toBeCloseTo(before, 0);
    }
  });

  test("asks before replacing meals from the mobile day detail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "webkit-iphone", "Mobile detail contract");
    const preset = { id: 1, name: "Día de entrenamiento", itemCount: 1, mealCounts: { BREAKFAST: 1 }, items: [{ itemType: "AI_ESTIMATE", displayName: "Desayuno", mealType: "BREAKFAST", quantity: 1, unit: "PORTION", calories: 300 }] };
    await seedAuthenticatedApp(page, { presets: [preset], currentItems: [{ itemType: "AI_ESTIMATE", displayName: "Comida actual", quantity: 1, calories: 200 }] });
    await page.goto("/ingresar");
    await page.locator(".day-preset-card-select").click();
    await page.getByRole("dialog", { name: "Día de entrenamiento" }).getByRole("button", { name: "Aplicar día" }).click();
    const choice = page.getByRole("dialog", { name: "Aplicar día guardado" });
    await expect(choice).toBeVisible();
    await expect(choice.getByRole("button", { name: "Sumar" })).toBeVisible();
    await expect(choice.getByRole("button", { name: "Reemplazar" })).toBeVisible();
    await choice.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog", { name: "Día de entrenamiento" })).toBeVisible();
  });
  test("does not submit the old preset while adding a food during edit", async ({ page }) => {
    let updatePayload;
    const preset = {
      id: 1,
      name: "Día completo",
      description: null,
      itemCount: 1,
      mealCounts: { BREAKFAST: 1 },
      items: [{ itemType: "FOOD", itemId: 11, mealType: "BREAKFAST", quantity: 100, unit: "GRAM", displayName: "Avena", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7 }],
    };
    await page.addInitScript(() => {
      history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "day-presets" }, "");
    });
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let body = {};
      if (url.pathname === "/api/auth/me") body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
      else if (url.pathname === "/api/nutrition/dashboard") body = { date: url.searchParams.get("date"), meals: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"].map((mealType) => ({ mealType, items: [] })) };
      else if (url.pathname === "/api/nutrition/day-presets" && request.method() === "GET") body = [preset];
      else if (url.pathname === "/api/nutrition/day-presets/1" && request.method() === "PUT") {
        updatePayload = request.postDataJSON();
        body = { ...preset, ...updatePayload, itemCount: updatePayload.items.length, mealCounts: { BREAKFAST: updatePayload.items.length } };
      } else if (url.pathname === "/api/foods" && url.searchParams.get("q") === "huevo") body = [{ id: 99, name: "Huevo", baseQuantity: 100, calories: 143, proteinGrams: 13, carbsGrams: 1, fatGrams: 10, category: "PROTEIN" }];
      else if (url.pathname === "/api/foods/99/preparations") body = [];
      else if (url.pathname === "/api/foods/preview") body = { calories: 143, proteinGrams: 13, carbsGrams: 1, fatGrams: 10 };
      else if (url.pathname === "/api/nutrition/ai-estimates/usage") body = { available: false };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.goto("/ingresar");
    if ((page.viewportSize()?.width || 0) <= 1200) {
      await page.locator(".day-preset-card-select").click();
      await page.getByRole("dialog", { name: "Día completo" }).getByRole("button", { name: "Editar", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Editar", exact: true }).click();
    }
    const editor = page.locator(".day-preset-editor-modal");
    await editor.getByRole("button", { name: "Agregar alimento o receta", exact: true }).first().click();
    await page.locator(".picker-modal input.search").fill("huevo");
    await page.getByRole("button", { name: /^Huevo/ }).click();
    await page.getByRole("button", { name: /Agregar a Desayuno/ }).click();

    await expect(editor.getByText("Huevo", { exact: true })).toBeVisible();
    await expect.poll(() => updatePayload).toBeUndefined();
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(() => updatePayload?.items?.some((item) => item.displayName === "Huevo")).toBe(true);
  });

  test("stacks the date controls vertically on iPhone WebKit", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("webkit-iphone"), "iPhone WebKit contract");

    await seedAuthenticatedApp(page);
    await page.goto("/ingresar");
    const datebar = page.locator(".day-presets-datebar");
    await expect(datebar).toBeVisible();

    const metrics = await datebar.evaluate((element) => {
      const children = Array.from(element.children).map((child) => child.getBoundingClientRect().toJSON());
      const input = element.querySelector("input").getBoundingClientRect().toJSON();
      const bar = element.getBoundingClientRect().toJSON();
      const styles = getComputedStyle(element);
      return {
        children,
        input,
        bar,
        display: styles.display,
        gridTemplateColumns: styles.gridTemplateColumns,
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.display).toBe("grid");
    expect(metrics.children).toHaveLength(3);
    expect(metrics.children[1].top).toBeGreaterThanOrEqual(metrics.children[0].bottom - 1);
    expect(metrics.children[2].top).toBeGreaterThanOrEqual(metrics.children[1].bottom - 1);
    expect(metrics.input.width).toBeLessThanOrEqual(metrics.children[1].width + 1);
    expect(metrics.bar.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  });
});
