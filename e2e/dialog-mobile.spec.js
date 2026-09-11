import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page, { aiAvailable = false, withFoodLog = false, withRecipeLog = false, recipeUnit = "PORTION", withManyRecipeIngredients = false, withNutrients = false, withPreset = false, withManyPickerResults = false, withServingFood = false, withYesterdaySuggestion = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  const yesterdayItem = { id: 301, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, food: { id: 11, name: "Avena", baseQuantity: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "OTHER" } };
  const recipeIngredients = withManyRecipeIngredients
    ? ["Zanahoria", "Avena", "Banana", "Cacao", "Canela", "Chía", "Frutilla", "Huevo", "Leche", "Manzana", "Miel", "Nuez", "Pera", "Queso", "Semillas", "Tomate", "Yogur", "Zapallo"].map((name, index) => ({ food: { id: 40 + index, name, baseQuantity: 100, proteinGrams: 5, carbsGrams: 15, fatGrams: 3, category: "OTHER" }, quantity: 40 + index, unit: "GRAM" }))
    : [{ food: { id: 14, name: "Zanahoria", baseQuantity: 100, proteinGrams: 1, carbsGrams: 10, fatGrams: 0, category: "VEGETABLE" }, quantity: 90, unit: "GRAM" }, { food: { id: 11, name: "Avena", baseQuantity: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "CEREAL" }, quantity: 150, unit: "GRAM" }];
  const recipeItem = { id: 202, itemType: "RECIPE", quantity: recipeUnit === "GRAM" ? 180 : 1, unit: recipeUnit, calories: 350, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, recipe: { id: 22, name: "Tostada proteica", rawTotalWeightGrams: 300, cookedTotalWeightGrams: 260, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, ingredients: recipeIngredients } };
  let targetDashboardDate = null;
  let currentMealItems = [];
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    let body = {};
    if (url.includes("/api/auth/me")) body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    if (url.includes("/nutrition/dashboard")) {
      const requestedDate = new URL(url).searchParams.get("date");
      if (withYesterdaySuggestion) {
        if (!targetDashboardDate) targetDashboardDate = requestedDate;
        const loggedItems = requestedDate !== targetDashboardDate ? [yesterdayItem] : currentMealItems;
        const hasItems = loggedItems.length > 0;
        const meals = [{ mealType: "BREAKFAST", label: "Desayuno", calories: hasItems ? 400 : 0, proteinGrams: hasItems ? 13 : 0, carbsGrams: hasItems ? 68 : 0, fatGrams: hasItems ? 7 : 0, items: loggedItems }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }];
        body = { date: requestedDate, caloriesConsumed: hasItems ? 400 : 0, calorieGoal: 2000, macros: [], meals, nutrients: [], waterConsumed: 0, waterGoal: 2, plan: null };
      } else {
        const loggedItems = withRecipeLog
          ? [recipeItem]
          : withFoodLog
            ? [{ id: 101, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, food: { id: 11, name: "Avena", baseQuantity: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "OTHER" } }]
            : [];
        const meals = (withFoodLog || withRecipeLog)
          ? [{ mealType: "BREAKFAST", label: "Desayuno", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, items: loggedItems }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }]
          : [{ mealType: "BREAKFAST", items: [] }, { mealType: "LUNCH", items: [] }, { mealType: "AFTERNOON_SNACK", items: [] }, { mealType: "DINNER", items: [] }];
        body = { date: "2026-08-25", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals, nutrients: withNutrients ? [{ code: "IRON", name: "Hierro", group: "MINERAL", value: 2, unit: "mg" }] : [], waterConsumed: 0, waterGoal: 2, plan: null };
      }
    }
    if (withYesterdaySuggestion && method === "POST" && url.includes("/api/nutrition/meal-logs/batch")) {
      currentMealItems = [{ ...yesterdayItem, id: 302 }];
    }
    if (withYesterdaySuggestion && method === "DELETE" && url.includes("/api/nutrition/food-logs")) {
      currentMealItems = [];
    }
    if (url.includes("/nutrition/meal-types")) body = [{ code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" }, { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" }];
    if (url.includes("/nutrition/day-presets")) body = withPreset ? [{ id: 1, name: "Día completo", itemCount: 1, mealCounts: { BREAKFAST: 1 }, items: [{ itemType: "FOOD", itemId: 11, mealType: "BREAKFAST", quantity: 100, unit: "GRAM", displayName: "Avena", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7 }] }] : [];
    if (url.includes("/nutrition/ai-estimates/usage")) body = { available: aiAvailable };
    if (url.includes("/api/foods?")) body = withServingFood
      ? [{ id: 11, name: "Avena", baseQuantity: 100, calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "CEREAL", servingName: "Porción", servingWeightGrams: 30 }]
      : withManyPickerResults
      ? Array.from({ length: 30 }, (_, index) => ({ id: 1000 + index, name: `Avena ${index + 1}`, baseQuantity: 100, calories: 120, proteinGrams: 10, carbsGrams: 20, fatGrams: 5, category: "CEREAL" }))
      : [];
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

test("expands a meal item with a brief desktop click", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  await meal.locator(".meal-item").click();
  await expect(meal.locator(".meal-item-detail")).toBeVisible();
});

test("keeps long press drag available without stealing a short click", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");

  const item = page.locator(".meal-card").filter({ hasText: "Avena" }).first().locator(".meal-item");
  const target = page.locator('.meal-card[data-meal-type="LUNCH"]');
  const itemBox = await item.boundingBox();
  const targetBox = await target.boundingBox();
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect(page.locator(".meal-item-shell.dragging")).toBeVisible();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await expect(target).toHaveClass(/drag-over/);
  await page.mouse.up();
});

test("allows copying yesterday again after deleting its last meal item", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { withYesterdaySuggestion: true });
  await page.goto("/ingresar");

  const meal = page.locator('.meal-card[data-meal-type="BREAKFAST"]');
  const copyButton = meal.getByRole("button", { name: "Copiar Desayuno de ayer" });
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(meal.locator(".meal-item")).toHaveCount(1);
  await expect(page.getByText("Desayuno copiado de ayer.", { exact: true })).toBeVisible();

  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(meal.locator(".meal-item")).toHaveCount(0);
  await expect(copyButton).toBeEnabled();

  await copyButton.click();
  await expect(meal.locator(".meal-item")).toHaveCount(1);
});

test("re-enables the other-day copy action after deleting the copied meal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { withYesterdaySuggestion: true });
  await page.goto("/ingresar");

  const meal = page.locator('.meal-card[data-meal-type="BREAKFAST"]');
  const pastMeals = page.locator(".past-meals-panel");
  await pastMeals.locator("summary").click();
  await pastMeals.getByRole("button", { name: "Vista previa" }).click();
  const applyButton = pastMeals.getByRole("button", { name: "Aplicar Desayuno" });
  await expect(applyButton).toBeVisible();
  await applyButton.click();
  await expect(applyButton).toBeDisabled();
  await expect(meal.locator(".meal-item")).toHaveCount(1);
  await expect(page.getByText("Comida copiada respetando su horario.", { exact: true })).toBeVisible();

  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(meal.locator(".meal-item")).toHaveCount(0);
  await expect(applyButton).toBeEnabled();

  await applyButton.click();
  await expect(meal.locator(".meal-item")).toHaveCount(1);
});

test("keeps a dismissed yesterday suggestion hidden", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withYesterdaySuggestion: true });
  await page.goto("/ingresar");

  const meal = page.locator('.meal-card[data-meal-type="BREAKFAST"]');
  const suggestion = meal.locator(".yesterday-suggestion");
  await expect(suggestion).toBeVisible();
  await suggestion.getByRole("button", { name: "Descartar sugerencia" }).click();
  await expect(suggestion).toHaveCount(0);
});

test("shows sorted recipe ingredients below the nutrition summary", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withRecipeLog: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Tostada proteica" }).first();
  await meal.locator(".meal-item").click();
  await expect(meal.locator(".recipe-detail-heading")).toHaveText(/Alimentos/);
  await expect(meal.locator(".recipe-ingredient-main > span:nth-child(2) > strong")).toHaveText(["Avena", "Zanahoria"]);
});

test("opens the food log editor with an accessible desktop footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const body = element.querySelector(".edit-log-body");
    const footer = element.querySelector(":scope > footer");
    return {
      rows: getComputedStyle(element).gridTemplateRows.split(" ").length,
      bodyOverflowY: getComputedStyle(body).overflowY,
      bodyOverflowX: getComputedStyle(body).overflowX,
      dialog: element.getBoundingClientRect().toJSON(),
      footer: footer.getBoundingClientRect().toJSON(),
      save: footer.querySelector(".primary").getBoundingClientRect().toJSON(),
      horizontalOverflow: element.scrollWidth > element.clientWidth,
    };
  });

  expect(layout.rows).toBe(3);
  expect(layout.bodyOverflowY).toBe("auto");
  expect(layout.bodyOverflowX).toBe("hidden");
  expect(layout.dialog.bottom).toBeLessThanOrEqual(480 + 1);
  expect(layout.footer.bottom).toBeLessThanOrEqual(480 + 1);
  expect(layout.save.bottom).toBeLessThanOrEqual(480 + 1);
  expect(layout.horizontalOverflow).toBe(false);
});

test("shows the editable recipe composition from the start", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withRecipeLog: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Tostada proteica" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Alimentos de la receta", { exact: true })).toBeVisible();
  await expect(dialog.locator(".daily-recipe-ingredient-copy strong")).toHaveText(["Avena", "Zanahoria"]);
  await expect(dialog.locator(".daily-recipe-ingredient .food-thumb")).toHaveCount(2);
  await expect(dialog.locator(".daily-recipe-ingredient-kcal")).toHaveText(["581 kcal", "40 kcal"]);
  await expect(dialog.getByLabel("Cantidad de Avena en gramos")).toBeVisible();
  await expect(dialog.getByText("Resumen nutricional", { exact: true })).toBeVisible();
});

test("keeps cooked-gram recipe ingredients visible and read only", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withRecipeLog: true, recipeUnit: "GRAM" });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Tostada proteica" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog.locator(".daily-recipe-locked")).toBeVisible();
  await expect(dialog.locator(".daily-recipe-ingredient-copy strong")).toHaveText(["Avena", "Zanahoria"]);
  await expect(dialog.locator(".daily-recipe-ingredient input")).toHaveCount(0);
  await expect(dialog.locator(".daily-recipe-ingredient-quantity strong")).toHaveText(["150", "90"]);
});

test("scrolls a long recipe body without losing the footer in mobile landscape", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 390 });
  await seedAuthenticatedApp(page, { withRecipeLog: true, withManyRecipeIngredients: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Tostada proteica" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  const body = dialog.locator(".edit-log-body");
  const save = dialog.getByRole("button", { name: "Guardar cambios" });
  await expect(dialog).toBeVisible();
  const beforeScroll = await body.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight);
  await body.hover();
  await page.mouse.wheel(0, 1000);

  const layout = await dialog.evaluate((element) => {
    const bodyElement = element.querySelector(".edit-log-body");
    const footer = element.querySelector(":scope > footer");
    return {
      bodyScrollTop: bodyElement.scrollTop,
      bodyOverflowY: getComputedStyle(bodyElement).overflowY,
      footerPosition: getComputedStyle(footer).position,
      footer: footer.getBoundingClientRect().toJSON(),
      body: bodyElement.getBoundingClientRect().toJSON(),
      save: footer.querySelector(".primary").getBoundingClientRect().toJSON(),
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(layout.bodyScrollTop).toBeGreaterThan(0);
  expect(layout.bodyOverflowY).toBe("auto");
  expect(layout.footerPosition).toBe("relative");
  expect(layout.footer.bottom).toBeLessThanOrEqual(390 + 1);
  expect(layout.save.bottom).toBeLessThanOrEqual(390 + 1);
  expect(layout.body.bottom).toBeLessThanOrEqual(layout.footer.top + 1);
  expect(layout.pageOverflow).toBe(false);
});

test("keeps recipe composition visible and scrollable in short mobile portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedAuthenticatedApp(page, { withRecipeLog: true, withManyRecipeIngredients: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Tostada proteica" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  const body = dialog.locator(".edit-log-body");
  const footer = dialog.locator(":scope > footer");
  await expect(dialog.getByText("Composición", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Alimentos de la receta", { exact: true })).toBeVisible();
  await expect(dialog.locator(".daily-recipe-ingredient").first()).toBeVisible();

  const beforeScroll = await body.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight);
  await body.hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));

  const layout = await dialog.evaluate((element) => {
    const bodyElement = element.querySelector(".edit-log-body");
    const footerElement = element.querySelector(":scope > footer");
    const lastIngredient = [...element.querySelectorAll(".daily-recipe-ingredient")].at(-1);
    return {
      dialog: element.getBoundingClientRect().toJSON(),
      body: bodyElement.getBoundingClientRect().toJSON(),
      footer: footerElement.getBoundingClientRect().toJSON(),
      lastIngredient: lastIngredient?.getBoundingClientRect().toJSON(),
      overflowY: getComputedStyle(bodyElement).overflowY,
      overflowX: getComputedStyle(bodyElement).overflowX,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(layout.dialog.bottom).toBeLessThanOrEqual(430 + 1);
  expect(layout.footer.bottom).toBeLessThanOrEqual(430 + 1);
  expect(layout.lastIngredient.bottom).toBeLessThanOrEqual(layout.body.bottom + 1);
  expect(layout.overflowY).toBe("auto");
  expect(layout.overflowX).toBe("hidden");
  expect(layout.pageOverflow).toBe(false);
  await expect(footer.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
});

test("hides nutrient details even when nutrient data is present", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withFoodLog: true, withNutrients: true });
  await page.goto("/ingresar");

  await expect(page.getByText("Más nutrientes", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Resumen nutricional del día", { exact: true })).toHaveCount(0);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
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

test("preselects grams when adding a food with a serving definition", async ({ page }) => {
  await seedAuthenticatedApp(page, { withServingFood: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByPlaceholder("Buscar alimentos...").fill("Avena");
  const foodRow = page.locator(".catalog-row-image").first();
  const metadata = foodRow.locator(".catalog-copy .catalog-meta");
  await expect(metadata).toHaveCSS("display", "flex");
  await expect(metadata).toHaveCSS("flex-direction", "column");
  await foodRow.click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog.getByLabel("Unidad")).toHaveValue("GRAM");
  await expect(dialog.getByLabel("Cantidad")).toHaveValue("30");
});

test("keeps the create food form scrollable above its fixed actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.locator(".register-option").filter({ hasText: "Crear alimento" }).click();

  const dialog = page.locator(".catalog-dialog");
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const content = element.querySelector(".catalog-dialog-content");
    const footer = element.querySelector(":scope > footer");
    content.scrollTop = content.scrollHeight;
    const lastField = content.querySelector('input[name="tags"]');
    return {
      contentOverflowY: getComputedStyle(content).overflowY,
      contentHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      ownerCount: element.querySelectorAll('[data-dialog-scroll-owner="true"]').length,
      footerPosition: getComputedStyle(footer).position,
      footerTop: footer.getBoundingClientRect().top,
      lastFieldBottom: lastField.getBoundingClientRect().bottom,
    };
  });

  expect(layout.contentOverflowY).toBe("auto");
  expect(layout.contentScrollHeight).toBeGreaterThan(layout.contentHeight);
  expect(layout.ownerCount).toBe(1);
  expect(layout.footerPosition).toBe("absolute");
  expect(layout.lastFieldBottom).toBeLessThanOrEqual(layout.footerTop + 1);
});

test("keeps desktop food picker controls above long results", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedAuthenticatedApp(page, { withManyPickerResults: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByPlaceholder("Buscar alimentos...").fill("avena");
  await expect(page.locator(".picker-results .catalog-row")).toHaveCount(30);
  await expect(page.locator(".picker-results .catalog-row-image .catalog-copy .catalog-meta").first()).toHaveCSS("display", "flex");
  await expect(page.locator(".picker-results .catalog-row-image .catalog-copy .catalog-meta").first()).toHaveCSS("flex-direction", "column");

  const layout = await page.locator(".picker-modal").evaluate((modal) => {
    const getRect = (selector) => modal.querySelector(selector).getBoundingClientRect();
    const scrollElement = modal.querySelector(".picker-scroll");
    const tabs = getRect(".picker-tabs");
    const tools = getRect(".picker-tools");
    const scroll = scrollElement.getBoundingClientRect();
    const footer = modal.querySelector(":scope > footer").getBoundingClientRect();
    return {
      tabsBottom: tabs.bottom,
      toolsTop: tools.top,
      toolsBottom: tools.bottom,
      scrollTop: scroll.top,
      scrollBottom: scroll.bottom,
      footerTop: footer.top,
      scrollHeight: scrollElement.scrollHeight,
      clientHeight: scrollElement.clientHeight,
    };
  });

  expect(layout.tabsBottom).toBeLessThanOrEqual(layout.toolsTop + 1);
  expect(layout.toolsBottom).toBeLessThanOrEqual(layout.scrollTop + 1);
  expect(layout.scrollBottom).toBeLessThanOrEqual(layout.footerTop + 1);
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
});

test("converts a logged meal into a recipe from the meal actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");

  const meal = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  await meal.locator(".meal-menu summary").click();
  await meal.getByRole("button", { name: "Convertir en receta" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Convertir desayuno en receta" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nombre de la receta").fill("Avena del desayuno");
  const currentDate = await page.evaluate(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  });
  const requestPromise = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/recipes/from-meal"));
  await dialog.getByRole("button", { name: "Guardar receta" }).click();
  expect((await requestPromise).postDataJSON()).toMatchObject({
    name: "Avena del desayuno",
    mealType: "BREAKFAST",
    logDate: currentDate,
    cookedTotalWeightGrams: null,
  });
  await expect(dialog).toBeHidden();
});

test("shares a logged meal bracket from the dashboard header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.route("**/api/nutrition/meal-shares", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      token: "dashboard-share-token",
      expiresAt: "2026-08-31T00:00:00Z",
      preview: {
        sourceDate: "2026-08-25",
        sourceMealType: "BREAKFAST",
        sourceMealLabel: "Desayuno",
        calories: 400,
        proteinGrams: 13,
        carbsGrams: 68,
        fatGrams: 7,
        items: [{ itemType: "FOOD", name: "Avena", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, estimated: false }],
      },
    }) });
  });
  const createShare = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/nutrition/meal-shares"));
  await page.goto("/ingresar");

  const breakfast = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  const lunch = page.locator('.meal-card[data-meal-type="LUNCH"]');
  await expect(breakfast.getByRole("button", { name: "Compartir Desayuno" })).toBeEnabled();
  await expect(lunch.getByRole("button", { name: "Compartir Almuerzo" })).toBeDisabled();
  const headerActions = await breakfast.locator(".meal-header-actions > *").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  }));
  expect(headerActions).toHaveLength(3);
  expect(headerActions[1].left).toBeGreaterThanOrEqual(headerActions[0].right - 1);
  expect(headerActions[2].left).toBeGreaterThanOrEqual(headerActions[1].right - 1);
  await breakfast.getByRole("button", { name: "Compartir Desayuno" }).click();

  await expect(page.getByRole("heading", { name: "Compartir comida" })).toBeVisible();
  const request = await createShare;
  const currentDate = await page.evaluate(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  });
  expect(request.postDataJSON()).toEqual({ sourceDate: currentDate, mealType: "BREAKFAST" });
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

test("keeps the AI photo context actions visible above the picker footer on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator(".ai-gallery-trigger input").setInputFiles({
    name: "comida.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("test-image"),
  });

  const editor = page.locator(".ai-photo-context-editor");
  const analyzeButton = editor.getByRole("button", { name: "Analizar foto", exact: true });
  await expect(editor).toBeVisible();
  await expect(analyzeButton).toBeVisible();
  const layout = await editor.evaluate((element) => {
    const button = element.querySelector(".ai-photo-context-actions .primary");
    const buttonBounds = button.getBoundingClientRect();
    const subpanel = element.parentElement;
    const footer = element.closest(".picker-modal")?.querySelector(":scope > footer");
    const hitTarget = document.elementFromPoint(buttonBounds.left + buttonBounds.width / 2, buttonBounds.top + buttonBounds.height / 2);
    return {
      buttonBottom: buttonBounds.bottom,
      viewportBottom: window.innerHeight,
      subpanelZIndex: getComputedStyle(subpanel).zIndex,
      footerZIndex: footer ? getComputedStyle(footer).zIndex : "auto",
      hitTarget: hitTarget?.closest("button")?.textContent?.trim(),
    };
  });
  expect(layout.buttonBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
  expect(Number(layout.subpanelZIndex)).toBeGreaterThan(Number(layout.footerZIndex));
  expect(layout.hitTarget).toBe("Analizar foto");
});

test("creates a share link from a recent meal bracket", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page);
  await page.route("**/api/nutrition/recent-meals*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
      sourceDate: "2026-08-24",
      mealType: "LUNCH",
      label: "Almuerzo",
      calories: 540,
      proteinGrams: 32,
      carbsGrams: 48,
      fatGrams: 18,
      items: [{ id: 10, itemType: "FOOD", food: { name: "Pollo", id: 10 }, quantity: 200, unit: "GRAM", calories: 540, proteinGrams: 32, carbsGrams: 48, fatGrams: 18 }],
    }] ) });
  });
  await page.route("**/api/nutrition/meal-shares", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      token: "created-token",
      expiresAt: "2026-08-31T00:00:00Z",
      preview: {
        sourceDate: "2026-08-24",
        sourceMealType: "LUNCH",
        sourceMealLabel: "Almuerzo",
        calories: 540,
        proteinGrams: 32,
        carbsGrams: 48,
        fatGrams: 18,
        items: [{ itemType: "FOOD", name: "Pollo", quantity: 200, unit: "GRAM", calories: 540, proteinGrams: 32, carbsGrams: 48, fatGrams: 18, estimated: false }],
      },
    }) });
  });
  const createShare = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/nutrition/meal-shares"));
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("tab", { name: "Recientes" }).click();
  await page.locator(".picker-recent-meals").getByRole("button", { name: "Compartir Almuerzo" }).click();
  await expect(page.getByRole("heading", { name: "Compartir comida" })).toBeVisible();
  const request = await createShare;
  expect(request.postDataJSON()).toEqual({ sourceDate: "2026-08-24", mealType: "LUNCH" });
  await expect(page.getByLabel("Enlace de invitación")).toHaveValue(/\/ingresar\?compartir=/);
});

test("accepts a shared meal link after authentication", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page);
  await page.route("**/api/nutrition/meal-shares/shared-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      sourceDate: "2026-08-24",
      sourceMealType: "LUNCH",
      sourceMealLabel: "Almuerzo",
      calories: 540,
      proteinGrams: 32,
      carbsGrams: 48,
      fatGrams: 18,
      expiresAt: "2026-08-31T00:00:00Z",
      alreadyAccepted: false,
      items: [{ itemType: "FOOD", name: "Pollo", quantity: 200, unit: "GRAM", calories: 540, proteinGrams: 32, carbsGrams: 48, fatGrams: 18, estimated: false }],
    }) });
  });
  const acceptShare = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/nutrition/meal-shares/shared-token/accept"));
  await page.goto("/ingresar?compartir=shared-token");
  await expect(page.getByRole("heading", { name: "Agregar comida compartida" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar a mi día" }).click();
  const request = await acceptShare;
  expect(request.postDataJSON()).toMatchObject({ mealType: "LUNCH" });
});
