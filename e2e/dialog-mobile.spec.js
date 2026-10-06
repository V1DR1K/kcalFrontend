import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page, { aiAvailable = false, withFoodLog = false, withRecipeLog = false, recipeUnit = "PORTION", withManyRecipeIngredients = false, withNutrients = false, withPreset = false, withManyPickerResults = false, withServingFood = false, withRecipePicker = false, withRecipeLibrary = false, withYesterdaySuggestion = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  const yesterdayItem = { id: 301, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, food: { id: 11, name: "Avena", baseQuantity: 100, calories: 387, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "OTHER" } };
  const recipeIngredients = withManyRecipeIngredients
    ? ["Zanahoria", "Avena", "Banana", "Cacao", "Canela", "Chía", "Frutilla", "Huevo", "Leche", "Manzana", "Miel", "Nuez", "Pera", "Queso", "Semillas", "Tomate", "Yogur", "Zapallo"].map((name, index) => ({ food: { id: 40 + index, name, baseQuantity: 100, proteinGrams: 5, carbsGrams: 15, fatGrams: 3, category: "OTHER" }, quantity: 40 + index, unit: "GRAM" }))
    : [{ food: { id: 14, name: "Zanahoria", baseQuantity: 100, calories: 44, proteinGrams: 1, carbsGrams: 10, fatGrams: 0, category: "VEGETABLE" }, quantity: 90, unit: "GRAM" }, { food: { id: 11, name: "Avena", baseQuantity: 100, calories: 387, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "CEREAL" }, quantity: 150, unit: "GRAM" }];
  const recipe = { id: 22, name: "Tostada proteica", description: "Una preparación simple para el desayuno.", rawTotalWeightGrams: 300, cookedTotalWeightGrams: 260, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, ingredients: recipeIngredients };
  const recipeItem = { id: 202, itemType: "RECIPE", quantity: recipeUnit === "GRAM" ? 180 : 1, unit: recipeUnit, calories: 350, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, recipe };
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
            ? [{ id: 101, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, food: { id: 11, name: "Avena", baseQuantity: 100, calories: 387, proteinGrams: 13, carbsGrams: 68, fatGrams: 7, category: "OTHER" } }]
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
    if (url.includes("/api/recipes/22")) body = recipe;
    if (url.includes("/api/recipes/mine?")) body = withRecipeLibrary ? [recipe] : [];
    if (url.includes("/api/recipes?")) body = withRecipePicker ? [recipe] : [];
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

test("keeps the scanner form inside a reduced mobile visual viewport", async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.getByRole("button", { name: /Escanear código de barras/i }).click();
  await page.getByRole("button", { name: "Código manual" }).click();
  await page.locator("#manual-barcode").fill("7791234567890");
  // Playwright cannot resize an emulated iPhone viewport after navigation in
  // WebKit. The short Safari project exercises the initial 390x430 contract;
  // this flow still validates the scanner's internal scroll owner here.
  if (!(browserName === "webkit" && testInfo.project.name.includes("iphone"))) {
    await page.setViewportSize({ width: 402, height: 430 });
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const bounds = await page.locator(".scanner-result").evaluate((element) => element.getBoundingClientRect().toJSON());
    const inputBounds = await page.locator("#manual-barcode").evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(bounds.bottom).toBeLessThanOrEqual(viewportHeight + 1);
    expect(inputBounds.bottom).toBeLessThanOrEqual(viewportHeight + 1);
  }
  await expect(page.locator(".scanner-result")).toHaveCSS("overflow-y", "auto");
});

test("opens the consumed quantity editor at the top on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withFoodLog: true });
  await page.goto("/ingresar");
  const meal = page.locator(".meal-card").filter({ hasText: "Avena" }).first();
  await meal.locator(".meal-item").click();
  await meal.locator(".meal-item-detail-actions button").filter({ hasText: "Editar" }).click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThanOrEqual(1);

  const quantity = dialog.getByLabel("Cantidad");
  await quantity.focus();
  await quantity.fill("42,5");
  await expect(quantity).toHaveValue("42.5");
  const backgroundScrollBeforeKeyboard = await page.locator('[data-app-scroll-root="true"]').evaluate((element) => element.scrollTop);
  const appShellHeightBeforeKeyboard = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-shell-height"));
  await page.setViewportSize({ width: 390, height: 430 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect.poll(() => quantity.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const footerTop = element.closest(".edit-log-modal")?.querySelector(":scope > footer")?.getBoundingClientRect().top ?? viewportHeight;
    return rect.top >= 0 && rect.bottom <= Math.min(viewportHeight, footerTop) + 1;
  })).toBe(true);
  const compactBounds = await dialog.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    footerBottom: element.querySelector(":scope > footer").getBoundingClientRect().bottom,
    viewport: window.visualViewport?.height || window.innerHeight,
  }));
  expect(compactBounds.top).toBeGreaterThanOrEqual(-1);
  expect(compactBounds.bottom).toBeLessThanOrEqual(compactBounds.viewport + 1);
  expect(compactBounds.footerBottom).toBeLessThanOrEqual(compactBounds.viewport + 1);
  expect(await page.locator('[data-app-scroll-root="true"]').evaluate((element) => element.scrollTop)).toBe(backgroundScrollBeforeKeyboard);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-shell-height"))).toBe(appShellHeightBeforeKeyboard);
  const modalBody = dialog.locator(".edit-log-body");
  expect(await modalBody.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  const modalBodyScrollBeforeRestore = await modalBody.evaluate((element) => element.scrollTop);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "false");
  await expect(dialog).toBeVisible();
  expect(await modalBody.evaluate((element) => element.scrollTop)).toBe(modalBodyScrollBeforeRestore);
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
  const deleteButton = meal.locator(".meal-item-detail-actions button").filter({ hasText: "Eliminar" });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click({ force: true });
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

test("shows recipe description and composition when adding it to a meal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withRecipePicker: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("tab", { name: "Recetas", exact: true }).click();
  await page.getByRole("button", { name: /Tostada proteica/ }).click();

  const dialog = page.locator(".recipe-log-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Una preparación simple para el desayuno.", { exact: true })).toBeVisible();
  await expect(dialog.locator(".daily-recipe-ingredient .food-thumb")).toHaveCount(2);
  await expect(dialog.getByLabel("Cantidad de Avena en gramos")).toBeVisible();
  await expect(dialog.getByText("Resumen nutricional", { exact: true })).toBeVisible();
});

test("uses the composition row in recipe creation and editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withServingFood: true, withRecipeLibrary: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.getByRole("button", { name: /Recetas Consultá tus recetas/ }).click();
  await page.getByRole("button", { name: "Crear receta", exact: true }).click();

  const createDialog = page.locator(".recipe-create-dialog");
  await expect(createDialog.getByLabel("Descripción opcional")).toBeVisible();
  await createDialog.getByRole("button", { name: "Agregar alimento o receta", exact: true }).click();
  const ingredientPicker = page.locator(".picker-modal");
  await expect(ingredientPicker.getByRole("heading", { name: "Agregar ingrediente" })).toBeVisible();
  await ingredientPicker.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("avena");
  await ingredientPicker.getByRole("button", { name: /Avena/ }).click();
  const ingredientDialog = page.locator(".edit-log-modal");
  await expect(ingredientDialog.getByLabel("Cantidad")).toBeVisible();
  await ingredientDialog.getByRole("button", { name: "Agregar ingrediente", exact: true }).click();
  const createRow = createDialog.locator(".daily-recipe-ingredient");
  await expect(createRow.locator(".food-thumb")).toHaveCount(1);
  await expect(createDialog.getByLabel("Cantidad de Avena en gramos")).toBeVisible();
  const createRowLayout = await createRow.evaluate((element) => ({
    image: element.querySelector(".food-thumb")?.getBoundingClientRect().toJSON(),
    quantity: element.querySelector(".daily-recipe-ingredient-quantity")?.getBoundingClientRect().toJSON(),
  }));
  expect(createRowLayout.image.left).toBeLessThan(createRowLayout.quantity.left);
  await createDialog.getByRole("button", { name: "Quitar" }).click();
  await expect(createDialog.locator(".daily-recipe-ingredient")).toHaveCount(0);
  await createDialog.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Descartar cambios" }).click();

  await page.locator(".collection-library-select").first().click();
  const recipeDetail = page.getByRole("dialog", { name: "Tostada proteica" });
  await expect(recipeDetail).toBeVisible();
  await recipeDetail.getByRole("button", { name: "Editar receta", exact: true }).click();
  const editDialog = page.locator(".recipe-editor-modal");
  await expect(editDialog.getByLabel("Descripción opcional")).toHaveValue("Una preparación simple para el desayuno.");
  await expect(editDialog.locator(".daily-recipe-ingredient .food-thumb")).toHaveCount(2);
  await expect(editDialog.getByLabel("Cantidad de Avena en gramos")).toBeVisible();
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
  await body.evaluate((element) => element.scrollBy({ top: 1000, left: 0, behavior: "auto" }));

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
  await body.evaluate((element) => element.scrollBy({ top: 1000, left: 0, behavior: "auto" }));
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

test("keeps photo buttons reachable while searching with the mobile keyboard open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  const picker = page.locator(".picker-modal");
  await picker.getByRole("searchbox", { name: /Buscar alimentos/ }).focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {configurable:true, get:()=>430});
    Object.defineProperty(window.visualViewport, "offsetTop", {configurable:true, get:()=>0});
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  const layout = await picker.locator(".picker-photo-actions").evaluate((footer) => ({
    footer: footer.getBoundingClientRect().toJSON(),
    buttons: [...footer.querySelectorAll(".ai-photo-trigger")].map((button) => button.getBoundingClientRect().toJSON()),
  }));
  expect(layout.buttons).toHaveLength(2);
  expect(layout.buttons.every((button) => button.width >= 44 && button.height >= 44 && button.bottom <= 430)).toBe(true);
  expect(layout.footer.bottom).toBeLessThanOrEqual(430);
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
  expect(layout.rows).toBe(5);
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

  expect(layout.rows).toBe(5);
  expect(layout.tabs.height).toBeLessThan(60);
  expect(layout.status.top).toBeGreaterThanOrEqual(layout.scroll.top);
  expect(layout.status.bottom).toBeLessThanOrEqual(layout.scroll.bottom);
  expect(layout.tools.bottom).toBeLessThanOrEqual(layout.scroll.top);
  expect(layout.overflowX).toBe("hidden");
  expect(layout.overflowY).toBe("auto");
  expect(layout.hasHorizontalOverflow).toBe(false);
  expect(layout.statusOrder).toBe("-1");
});

test("keeps a long AI photo description scrollable on mobile", async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();

  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "comida.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });

  const dialog = page.locator(".ai-photo-context-modal");
  const description = dialog.getByLabel("Descripción opcional");
  await expect(dialog).toBeVisible();
  await description.fill("Ensalada completa con pollo grillado, arroz integral, tomate, palta, semillas y aderezo casero. La porción es abundante y está servida en un plato grande. También incluye zanahoria, cebolla morada y hojas verdes frescas.");

  const layout = await dialog.evaluate((element) => {
    const textarea = element.querySelector(".modal-shell-content textarea");
    const actions = element.querySelector(":scope > .modal-shell-footer");
    return {
      dialog: element.getBoundingClientRect().toJSON(),
      textarea: textarea.getBoundingClientRect().toJSON(),
      textareaOverflowY: getComputedStyle(textarea).overflowY,
      textareaScrollHeight: textarea.scrollHeight,
      textareaClientHeight: textarea.clientHeight,
      actions: actions.getBoundingClientRect().toJSON(),
      horizontalOverflow: element.scrollWidth > element.clientWidth,
    };
  });

  expect(layout.textareaOverflowY).toBe("auto");
  expect(layout.textareaScrollHeight).toBeGreaterThan(layout.textareaClientHeight);
  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.actions.bottom).toBeLessThanOrEqual(844 + 1);

  await description.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => description.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const touchResult = await description.evaluate((element) => {
    const dispatchTouch = (type, clientY) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: [{ clientY }] });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    element.scrollTop = Math.min(24, element.scrollHeight - element.clientHeight);
    dispatchTouch("touchstart", 200);
    const upwardPrevented = dispatchTouch("touchmove", 240);
    element.scrollTop = 0;
    dispatchTouch("touchstart", 200);
    const downwardPrevented = dispatchTouch("touchmove", 150);
    return { upwardPrevented, downwardPrevented };
  });
  expect(touchResult.upwardPrevented).toBe(false);
  expect(touchResult.downwardPrevented).toBe(false);
  await description.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect.poll(() => description.evaluate((element) => element.scrollTop)).toBe(0);

  // WebKit's emulated iPhone keeps the device viewport height when resized
  // after navigation. The dedicated short-viewport Safari project covers the
  // same contract from page creation; keep this flow focused on inner scroll.
  if (!(browserName === "webkit" && testInfo.project.name.includes("iphone"))) {
    await page.setViewportSize({ width: 390, height: 430 });
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--app-viewport-height", "430px");
      document.documentElement.style.setProperty("--dialog-viewport-height", "430px");
      document.documentElement.style.setProperty("--dialog-visible-height", "430px");
      document.documentElement.style.setProperty("--dialog-layout-height", "430px");
    });
    const reducedLayout = await dialog.evaluate((element) => ({
      dialog: element.getBoundingClientRect().toJSON(),
      actions: element.querySelector(".ai-photo-context-actions").getBoundingClientRect().toJSON(),
    }));
    expect(reducedLayout.dialog.bottom).toBeLessThanOrEqual(430 + 1);
    expect(reducedLayout.actions.bottom).toBeLessThanOrEqual(430 + 1);
  }
  if (browserName === "chromium") {
    await page.evaluate(() => {
      ["--app-viewport-height", "--dialog-viewport-height", "--dialog-visible-height", "--dialog-layout-height"].forEach((property) => document.documentElement.style.removeProperty(property));
    });
    await page.setViewportSize({ width: 320, height: 568 });
    const footerMetrics = await dialog.evaluate((element) => {
      const footer = element.querySelector(":scope > .modal-shell-footer").getBoundingClientRect();
      const buttons = [...element.querySelectorAll(":scope > .modal-shell-footer button")].map((button) => { const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; });
      return { footerBottom: footer.bottom, viewportHeight: window.visualViewport?.height || window.innerHeight, buttons };
    });
    expect(footerMetrics.footerBottom).toBeLessThanOrEqual(footerMetrics.viewportHeight + 1);
    expect(footerMetrics.buttons.every((button) => button.width >= 44 && button.height >= 44 && button.right <= 321 && button.bottom <= footerMetrics.viewportHeight + 1)).toBe(true);
  }
});

test("preselects grams when adding a food with a serving definition", async ({ page }) => {
  await seedAuthenticatedApp(page, { withServingFood: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("Avena");
  const foodRow = page.locator(".catalog-row-image").first();
  const metadata = foodRow.locator(".catalog-copy .catalog-meta");
  await expect(metadata).toHaveCSS("display", "flex");
  await expect(metadata).toHaveCSS("flex-direction", "column");
  await foodRow.click();

  const dialog = page.locator(".edit-log-modal");
  await expect(dialog.getByLabel("Unidad")).toHaveValue("GRAM");
  await expect(dialog.getByLabel("Cantidad")).toHaveValue("30");
});

test("keeps the create food form scrollable above its integrated actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedAuthenticatedApp(page);
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.locator(".register-option").filter({ hasText: "Crear alimento" }).click();

  const dialog = page.locator(".catalog-dialog");
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const content = element.querySelector(".catalog-dialog-content");
    content.scrollTop = content.scrollHeight;
    const lastField = content.querySelector('input[name="tags"]');
    const actions = content.querySelector(".food-editor-dialog-actions");
    return {
      contentOverflowY: getComputedStyle(content).overflowY,
      contentHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      ownerCount: element.querySelectorAll('[data-dialog-scroll-owner="true"]').length,
      actionsPosition: getComputedStyle(actions).position,
      actionsTop: actions.getBoundingClientRect().top,
      lastFieldBottom: lastField.getBoundingClientRect().bottom,
    };
  });

  expect(layout.contentOverflowY).toBe("auto");
  expect(layout.contentScrollHeight).toBeGreaterThan(layout.contentHeight);
  expect(layout.ownerCount).toBe(1);
  expect(layout.actionsPosition).toBe("sticky");
  expect(layout.lastFieldBottom).toBeLessThanOrEqual(layout.actionsTop + 1);
});

test("keeps desktop food picker controls above long results", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedAuthenticatedApp(page, { withManyPickerResults: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("avena");
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
  await expect(lunch.getByRole("button", { name: "Compartir Almuerzo", includeHidden:true })).toBeDisabled();
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
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "comida.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("test-image"),
  });

  const textarea = page.locator(".ai-context-field textarea").first();
  await expect(textarea).toBeVisible();
  await textarea.focus();
  await expect(textarea).toHaveCSS("font-size", "16px");
});

test("keeps the day preset editor footer reachable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withPreset: true, withFoodLog:true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Guardar este día" }).click();

  const modal = page.locator(".abm-editor-modal");
  await expect(modal).toBeVisible();
  const layout = await modal.evaluate((element) => {
    const footer = element.querySelector(":scope > footer, .modal-shell-footer")?.getBoundingClientRect();
    const body = element.querySelector("[data-dialog-scroll-owner]")?.getBoundingClientRect();
    return { footerBottom: footer?.bottom, bodyBottom: body?.bottom, viewportBottom: window.innerHeight };
  });
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
  expect(layout.bodyBottom).toBeLessThanOrEqual(layout.footerBottom + 1);
});

test("shows only nutrition plans in nutrition mode", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await seedAuthenticatedApp(page);
  await page.addInitScript(() => history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "plans" }, ""));
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", { name: "Plan alimenticio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planes de entrenamiento", exact: true })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/api/training/plans"))).toBe(false);
});

test("keeps AI estimate actions in the editor flow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  let analyzeMethod = "";
  let analyzeTarget = "";
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    analyzeMethod = route.request().method();
    analyzeTarget = (route.request().postData() || "").includes("RECIPE") ? "RECIPE" : "";
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ targetType: "RECIPE", name: "Comida estimada", confidence: 86, description: "Una comida simple", assumptions: [], items: [{ name: "Avena", category: "OTHER", preparation: "UNSPECIFIED", estimatedGrams: 100, proteinGrams: 13, carbsGrams: 68, fatGrams: 7 }, { name: "Leche", category: "DAIRY", preparation: "UNSPECIFIED", estimatedGrams: 100, proteinGrams: 3, carbsGrams: 5, fatGrams: 2 }] }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "comida.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  const photoDialog = page.locator(".ai-photo-context-modal");
  const analyzeButton = photoDialog.getByRole("button", { name: "Analizar foto", exact: true });
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await expect.poll(() => analyzeMethod).toBe("POST");
  expect(analyzeTarget).toBe("RECIPE");

  const editor = page.locator(".ai-estimate-modal");
  await expect(editor).toBeVisible();
  await expect(editor.locator(".ai-estimate-item-details[open]")).toHaveCount(0);
  const layout = await editor.evaluate((element) => {
    const footerElement = element.querySelector(":scope > .modal-shell-footer");
    const footer = footerElement.getBoundingClientRect();
    const content = element.querySelector(".modal-shell-content");
    return { footerTop: footer.top, footerBottom: footer.bottom, footerHeight: footer.height, contentPaddingBottom: parseFloat(getComputedStyle(content).paddingBottom), viewportBottom: window.visualViewport?.height || window.innerHeight };
  });
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
  expect(layout.contentPaddingBottom).toBeGreaterThanOrEqual(layout.footerHeight - 1);
  await expect(editor.getByRole("button", { name: "Revisar coincidencias y guardar", exact: true })).toBeVisible();
  const grams = editor.getByLabel("Gramos").first();
  await grams.focus();
  await page.setViewportSize({ width: 390, height: 430 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect.poll(() => grams.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const surface = element.closest(".ai-estimate-modal").getBoundingClientRect();
    const footerTop = element.closest(".ai-estimate-modal").querySelector(":scope > .modal-shell-footer").getBoundingClientRect().top;
    const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
    return {visible:rect.top >= surface.top - 1 && rect.bottom <= footerTop + 1 && rect.bottom <= viewportBottom + 1, top:rect.top, bottom:rect.bottom, surfaceTop:surface.top, footerTop, viewportBottom, focused:document.activeElement === element};
  })).toMatchObject({visible:true,focused:true});
  const aiFooterBottom = await editor.locator(":scope > .modal-shell-footer").evaluate((element) => element.getBoundingClientRect().bottom);
  expect(aiFooterBottom).toBeLessThanOrEqual(430 + 1);
  const editorScrollBeforeRestore = await editor.locator(".modal-shell-content").evaluate((element) => element.scrollTop);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "false");
  expect(await editor.locator(".modal-shell-content").evaluate((element) => element.scrollTop)).toBe(editorScrollBeforeRestore);
});

test("registers an AI food from the diary and keeps its meal destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  let analyzeTarget = "";
  let confirmation = null;
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    analyzeTarget = (request.postData() || "").includes("RECIPE") ? "RECIPE_FALLBACK" : "";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      captureId: "capture-food-test",
      targetType: "FOOD",
      name: "Fideos secos",
      confidence: 91,
      description: "Paquete de fideos secos.",
      assumptions: [],
      items: [{ name: "Fideos secos", category: "CEREAL", preparation: "AS_SOLD", estimatedGrams: 100, proteinGrams: 12, carbsGrams: 72, fatGrams: 2 }],
    }) });
  });
  await page.route("**/api/nutrition/ai-registrations/matches", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ itemIndex: 0, match: null }] }) });
  });
  await page.route("**/api/nutrition/ai-registrations/confirm", async (route) => {
    expect(route.request().method()).toBe("POST");
    confirmation = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      targetType: "FOOD", food: { id: 301, name: "Fideos secos" },
      log: { id: 401, itemType: "FOOD", mealType: "BREAKFAST", quantity: 100, unit: "GRAM" },
    }) });
  });

  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "fideos.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  const photoDialog = page.locator(".ai-photo-context-modal");
  await photoDialog.getByRole("button", { name: "Analizar foto", exact: true }).click();

  const estimateDialog = page.locator(".ai-estimate-modal");
  await expect(estimateDialog).toBeVisible();
  await expect(estimateDialog.getByRole("status")).toContainText("1 alimento detectado");
  await expect(estimateDialog.getByLabel("Agregar también a mi día")).toBeChecked();
  await estimateDialog.getByRole("button", { name: "Revisar coincidencias y guardar", exact: true }).click();
  await expect.poll(() => confirmation).not.toBeNull();
  expect(analyzeTarget).toBe("RECIPE_FALLBACK");
  expect(confirmation).toMatchObject({ addToDiary: true, mealType: "BREAKFAST", captureId: "capture-food-test" });
  expect(confirmation.items[0].name).toBe("Fideos secos");
  expect(confirmation.resolutions).toEqual([{ itemIndex: 0, choice: "KEEP_ESTIMATE" }]);
});

test("automatically registers a single detected food as a food", async ({ page }) => {
  await seedAuthenticatedApp(page, { aiAvailable: true });
  let analyzeTarget = "";
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    analyzeTarget = (request.postData() || "").includes("RECIPE") ? "LEGACY_RECIPE_FALLBACK" : "";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ targetType: "FOOD", name: "Arroz", confidence: 85, assumptions: [], items: [{ name: "Arroz", category: "CEREAL", preparation: "COOKED", estimatedGrams: 150, proteinGrams: 4, carbsGrams: 42, fatGrams: 1 }] }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({ name: "envase.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  const photoDialog = page.locator(".ai-photo-context-modal");
  await photoDialog.getByRole("button", { name: "Analizar foto", exact: true }).click();
  await expect.poll(() => analyzeTarget).toBe("LEGACY_RECIPE_FALLBACK");
  await expect(page.locator(".ai-estimate-modal").getByRole("button", { name: "Revisar coincidencias y guardar", exact: true })).toBeVisible();
});

test("keeps a multi-food AI estimate usable at 320 by 568", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      name: "Almuerzo con varios ingredientes",
      confidence: 82,
      description: "Una preparación casera con porciones aproximadas.",
      assumptions: ["Se estimó una porción mediana.", "El aderezo no se distinguía con claridad."],
      items: [
        { name: "Pollo grillado", category: "MEAT", preparation: "GRILLED", estimatedGrams: 140, proteinGrams: 31, carbsGrams: 0, fatGrams: 5 },
        { name: "Arroz integral cocido", category: "CEREAL", preparation: "BOILED", estimatedGrams: 180, proteinGrams: 5, carbsGrams: 42, fatGrams: 2 },
        { name: "Ensalada de hojas verdes y tomate", category: "VEGETABLE", preparation: "RAW", estimatedGrams: 95, proteinGrams: 2, carbsGrams: 6, fatGrams: 1 },
      ],
    }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "comida.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Analizar foto", exact: true }).click();

  const dialog = page.locator(".ai-estimate-modal");
  await expect(dialog.locator(".ai-estimate-item")).toHaveCount(3);
  await expect(dialog.getByRole("status")).toContainText("3 alimentos detectados");
  await expect(dialog.getByRole("button", { name: "Revisar coincidencias y guardar", exact: true })).toBeVisible();
  await expect(dialog.getByText("Supuestos de la estimación", { exact: true })).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const footerElement = element.querySelector(":scope > .modal-shell-footer");
    const footer = footerElement.getBoundingClientRect();
    const surface = element.getBoundingClientRect();
    const summary = element.querySelector(".ai-estimate-summary");
    const fields = element.querySelector(".ai-estimate-item-fields");
    return {
      surfaceRight: surface.right,
      surfaceLeft: surface.left,
      footerBottom: footer.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.visualViewport?.height || window.innerHeight,
      summaryWidth: summary.scrollWidth,
      summaryClientWidth: summary.clientWidth,
      fieldsWidth: fields.scrollWidth,
      fieldsClientWidth: fields.clientWidth,
      actionButtons: [...footerElement.querySelectorAll("button")].map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
    };
  });
  expect(layout.surfaceLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.surfaceRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.summaryWidth).toBeLessThanOrEqual(layout.summaryClientWidth + 1);
  expect(layout.fieldsWidth).toBeLessThanOrEqual(layout.fieldsClientWidth + 1);
  expect(layout.actionButtons.every((button) => button.width >= 44 && button.height >= 44)).toBe(true);
  await page.setViewportSize({ width: 390, height: 430 });
  await expect(dialog.locator(".ai-estimate-summary small")).toHaveCount(4);
  const compactSummary = await dialog.locator(".ai-estimate-summary small").evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth + 1));
  expect(compactSummary).toBe(true);
  await expect.poll(() => dialog.locator(":scope > .modal-shell-footer").evaluate(element => element.getBoundingClientRect().bottom <= (window.visualViewport.offsetTop + window.visualViewport.height) + 1)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Revisar coincidencias y guardar", exact: true })).toBeVisible();
});

test("keeps the food search available behind only the top dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { withServingFood: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  const picker = page.locator(".picker-modal");
  const search = picker.getByRole("searchbox", { name: /Buscar alimentos/ });
  await search.fill("Avena");
  await picker.locator(".catalog-row-image").click();

  const roots = page.locator("[data-modal-root]");
  await expect(page.locator(".edit-log-modal")).toBeVisible();
  await expect.poll(() => roots.count()).toBe(2);
  const rootStates = await roots.evaluateAll((elements) => elements.map((element) => ({ inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") })));
  expect(rootStates).toEqual([{ inert: true, ariaHidden: "true" }, { inert: false, ariaHidden: null }]);
  await expect(page.locator('[data-modal-root]:not([aria-hidden="true"]) [role="dialog"][aria-modal="true"]')).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator(".edit-log-modal")).toHaveCount(0);
  await expect(picker).toBeVisible();
  await expect(search).toHaveValue("Avena");
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest(".picker-modal") != null)).toBe(true);
  await expect(picker.locator(".catalog-row-image")).toBeVisible();
});

test("keeps the AI photo context actions visible above the picker footer on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "comida.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("test-image"),
  });

  const editor = page.locator(".ai-photo-context-modal");
  const analyzeButton = editor.getByRole("button", { name: "Analizar foto", exact: true });
  await expect(editor).toBeVisible();
  await expect(analyzeButton).toBeVisible();
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click({ trial: true });
  const layout = await editor.evaluate((element) => {
    const button = element.querySelector(".ai-photo-context-actions .primary");
    const buttonBounds = button.getBoundingClientRect();
    const outerRoot = [...document.querySelectorAll("[data-modal-root]")].find((root) => root.querySelector(".picker-modal"));
    return {
      buttonBottom: buttonBounds.bottom,
      viewportBottom: window.innerHeight,
      pickerIsInert: outerRoot?.inert,
      pickerIsHidden: outerRoot?.getAttribute("aria-hidden"),
    };
  });
  expect(layout.buttonBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
  expect(layout.pickerIsInert).toBe(true);
  expect(layout.pickerIsHidden).toBe("true");
});

test("pastes an image before analysis, keeps text paste, and ignores images during review", async ({ page, browserName }) => {
  await seedAuthenticatedApp(page, { aiAvailable: true });
  if (browserName === "chromium") await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/nutrition/ai-estimates", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      targetType: "FOOD", name: "Avena", confidence: 85, assumptions: [],
      items: [{ name: "Avena", category: "CEREAL", preparation: "COOKED", estimatedGrams: 150, proteinGrams: 4, carbsGrams: 42, fatGrams: 1 }],
    }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({
    name: "preparacion.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  const photoEditor = page.locator(".ai-photo-context-modal");
  await expect(photoEditor).toBeVisible();

  const paste = (type) => page.evaluate((mimeType) => {
    const transfer = new DataTransfer();
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (character) => character.charCodeAt(0));
    transfer.items.add(new File([png], "clipboard-image", { type: mimeType }));
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    const dispatched = document.dispatchEvent(event);
    return { dispatched, types: Array.from(event.clipboardData.items).map((item) => ({ kind: item.kind, type: item.type })), prevented: event.defaultPrevented };
  }, type);
  const originalPhotoUrl = await photoEditor.locator("img.ai-photo-context-preview").getAttribute("src");
  const pngPaste = await paste("image/png");
  expect(pngPaste).toMatchObject({ types: [{ kind: "file", type: "image/png" }], prevented: true });
  await expect(photoEditor.locator("img.ai-photo-context-preview")).not.toHaveAttribute("src", originalPhotoUrl);
  await expect(photoEditor.locator("img.ai-photo-context-preview")).toBeVisible();

  await paste("image/gif");
  await expect(photoEditor.getByRole("alert")).toContainText("JPEG, PNG o WebP");
  await expect(photoEditor.locator("img.ai-photo-context-preview")).toBeVisible();

  const description = photoEditor.getByLabel("Descripción opcional");
  if (browserName === "chromium") {
    await page.evaluate(() => navigator.clipboard.writeText("una banana"));
    await description.focus();
    await page.keyboard.press("Control+V");
    await expect(description).toHaveValue("una banana");
  } else {
    const textWasPrevented = await description.evaluate((textarea) => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "una banana");
      const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: transfer });
      textarea.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(textWasPrevented).toBe(false);
  }
  await photoEditor.getByRole("button", { name: "Analizar foto", exact: true }).click();

  const estimateEditor = page.locator(".ai-estimate-modal");
  await expect(estimateEditor).toBeVisible();
  const pasteDuringReviewWasPrevented = await paste("image/png");
  expect(pasteDuringReviewWasPrevented.prevented).toBe(false);
  await expect(estimateEditor.getByRole("status")).toContainText("1 alimento detectado");
  await expect(page.locator(".ai-photo-context-modal")).toHaveCount(0);
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

test("keeps the food draft open and rolls back the optimistic diary entry when saving fails", async ({ page }) => {
  await seedAuthenticatedApp(page, { withServingFood: true });
  await page.route("**/api/foods/preview", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ calories: 120, proteinGrams: 4, carbsGrams: 20, fatGrams: 2 }),
  }));
  let releaseSave;
  const saveGate = new Promise((resolve) => { releaseSave = resolve; });
  await page.route("**/api/nutrition/meal-logs", async (route) => {
    await saveGate;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "No se pudo guardar" }) });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("Avena");
  await page.locator(".catalog-row-image").first().click();
  await page.locator(".edit-log-modal").getByRole("button", { name: "Agregar a Desayuno" }).click();

  await expect(page.locator(".edit-log-modal")).toBeVisible();
  await expect(page.locator(".meal-item-shell.optimistic")).toContainText("Avena");
  await expect(page.locator(".meal-item-shell.optimistic")).toContainText("Guardando");
  releaseSave();
  await expect(page.locator(".meal-item-shell.optimistic")).toHaveCount(0);
  await expect(page.locator(".edit-log-modal")).toBeVisible();
  await expect(page.locator(".edit-log-modal").getByLabel("Cantidad")).toHaveValue("30");
  await expect(page.locator(".edit-log-modal").getByRole("button", { name: "Agregar a Desayuno" })).toBeEnabled();
  await expect(page.locator(".meal-card").filter({ hasText: "Desayuno" }).first()).toContainText("Sin registros");
});


test("SG047 keeps AI text, close and actions inside a displaced keyboard viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthenticatedApp(page, { aiAvailable: true });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({ name: "meal.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  const dialog = page.locator(".ai-photo-context-modal");
  const input = dialog.getByRole("textbox");
  await input.fill("Descripción larga de la comida. ".repeat(7));
  await page.evaluate(() => {
    window.__keyboardFrame = { height: 320, offsetTop: 92 };
    for (const key of ["height", "offsetTop"]) Object.defineProperty(window.visualViewport, key, { configurable: true, get: () => window.__keyboardFrame[key] });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect.poll(() => input.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const modal = element.closest(".ai-photo-context-modal");
    const header = modal.querySelector("header").getBoundingClientRect();
    const footer = modal.querySelector(":scope > footer").getBoundingClientRect();
    const top = window.visualViewport.offsetTop;
    const bottom = top + window.visualViewport.height;
    return header.top >= top - 1 && footer.bottom <= bottom + 1 && rect.top >= header.bottom - 1 && rect.bottom <= footer.top + 1;
  })).toBe(true);
  const text = await input.inputValue();
  await input.press("End");
  await input.press("Backspace");
  await expect(input).toHaveValue(text.slice(0, -1));
  await expect(input).toBeFocused();
  await page.evaluate(() => {
    window.__keyboardFrame = { height: 844, offsetTop: 0 };
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "false");
  await expect(input).toHaveValue(text.slice(0, -1));
  await expect(dialog.getByRole("button", { name: "Descartar foto" })).toBeVisible();
});


test("SG005/007/011 valida cantidad y conserva datos ausentes con aviso cancelable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedAuthenticatedApp(page);
  const food = { id: 901, name: "Pollo pendiente", type: "FOOD", category: "PROTEIN", preparation: "COOKED", baseUnit: "GRAM", baseQuantity: 100, calories: null, proteinGrams: null, carbsGrams: 0, fatGrams: 0, cookedYieldAssumption: "food id 2" };
  let writes = 0;
  await page.route("**/api/foods**", async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/preview") ? { calories: null, proteinGrams: null, carbsGrams: 0, fatGrams: 0, nutritionComplete: false } : path.endsWith("/preparations") ? [] : path.endsWith("/901") ? food : { items: [food], page: 0, hasNext: false };
    await route.fulfill({ json: body });
  });
  await page.route("**/api/nutrition/meal-logs", async route => { writes++; await route.fulfill({ json: { id: 902, ...route.request().postDataJSON(), food, calories: null, proteinGrams: null, carbsGrams: 0, fatGrams: 0 } }); });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Agregar alimento a Desayuno", exact: true }).click();
  await page.getByRole("searchbox").fill("pollo");
  const row = page.locator(".catalog-row", { hasText: "Pollo pendiente" });
  await expect(row).toContainText("Por 100 g"); await expect(row).toContainText("incompleta");
  await row.click();
  const dialog = page.locator(".edit-log-modal");
  await expect(dialog).toContainText("Pesalo cocido"); await expect(dialog).not.toContainText("food id");
  const quantity = dialog.getByLabel("Cantidad", { exact: true });
  await quantity.fill("-1"); await expect(quantity).toHaveValue("-1");
  await expect(dialog.getByRole("button", { name: "Revisá la cantidad", exact: true })).toBeDisabled();
  await quantity.fill("12,5"); await expect(quantity).toHaveValue("12.5");
  await expect(dialog).toContainText("Sin dato");
  await dialog.getByRole("button", { name: "Agregar a Desayuno", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revisar información nutricional" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0); await expect(quantity).toHaveValue("12.5");
  await dialog.getByRole("button", { name: "Agregar a Desayuno", exact: true }).click();
  await page.getByRole("button", { name: "Registrar con aviso", exact: true }).click();
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(1);
});

test("SG038 cancels archived reuse without saving and acknowledges on acceptance", async ({ page }) => {
  await seedAuthenticatedApp(page);
  const food = { id: 903, type: "FOOD", name: "Avena archivada", baseUnit: "GRAM", baseQuantity: 100, calories: 100, proteinGrams: 10, carbsGrams: 10, fatGrams: 2, category: "CARB", archived: true };
  await page.route("**/api/foods**", async route => { const path = new URL(route.request().url()).pathname; await route.fulfill({ json: path.endsWith("/preview") ? food : path.endsWith("/preparations") ? [] : path.endsWith("/903") ? food : { items: [food], page: 0, hasNext: false } }); });
  let saved = 0;
  await page.route("**/api/nutrition/meal-logs", async route => {
    const body = route.request().postDataJSON();
    if (!body.acknowledgedArchivedFoodIds?.includes(903)) return route.fulfill({ status: 409, json: { code: "ARCHIVED_FOOD_ACKNOWLEDGEMENT_REQUIRED", fields: { archivedFoodIds: "903", archivedFoodNames: food.name } } });
    saved++; await route.fulfill({ json: { id: 904, ...body, food, calories: 100, proteinGrams: 10, carbsGrams: 10, fatGrams: 2 } });
  });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Agregar alimento a Desayuno/i }).click();
  await page.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("Avena");
  await page.locator(".catalog-row-image").filter({ hasText: food.name }).first().click();
  const dialog = page.locator(".edit-log-modal");
  await dialog.getByRole("button", { name: "Agregar a Desayuno", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Seguirán archivados");
  await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Agregar a Desayuno", exact: true })).toBeEnabled(); expect(saved).toBe(0);
  await dialog.getByRole("button", { name: "Agregar a Desayuno", exact: true }).click();
  await confirmation.getByRole("button", { name: "Reutilizar con aviso", exact: true }).click();
  await expect(dialog).not.toBeVisible(); expect(saved).toBe(1);
});

test("SG009/010 registers an existing food in the explicit date and meal", async ({ page }) => {
  await seedAuthenticatedApp(page);
  const food = { id: 905, type: "FOOD", name: "Avena destino", baseUnit: "GRAM", baseQuantity: 100, calories: 100, proteinGrams: 10, carbsGrams: 10, fatGrams: 2, category: "CARB" };
  await page.route("**/api/foods**", async route => { const path = new URL(route.request().url()).pathname; await route.fulfill({ json: path.endsWith("/preview") ? food : path.endsWith("/preparations") ? [] : path.endsWith("/905") ? food : { items: [food], page: 0, hasNext: false } }); });
  let saved;
  await page.route("**/api/nutrition/meal-logs", async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { id: 906, ...saved, food, ...food, itemType: "FOOD" } }); });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.getByLabel("Fecha del consumo", { exact: true }).fill("2026-09-28");
  await page.getByLabel("Comida del consumo", { exact: true }).selectOption("DINNER");
  await page.getByRole("button", { name: /Buscar y registrar alimento/ }).click();
  await expect(page.locator(".picker-destination")).toContainText("Cena");
  await page.getByRole("searchbox", { name: /Buscar alimentos/ }).fill("Avena");
  await page.locator(".catalog-row-image").filter({ hasText: food.name }).first().click();
  await page.locator(".edit-log-modal").getByRole("button", { name: "Agregar a Cena", exact: true }).click();
  await expect.poll(() => saved?.logDate).toBe("2026-09-28"); expect(saved.mealType).toBe("DINNER");
});

test("SG002/015–018 keeps balance separate across responsive widths", async ({ page }, testInfo) => {
  await seedAuthenticatedApp(page);
  await page.route("**/api/nutrition/dashboard**", async route => { await route.fulfill({ json: { date: new URL(route.request().url()).searchParams.get("date"), caloriesConsumed: 0, calorieGoal: 12345, macros: [], meals: [] } }); });
  await page.goto("/ingresar");
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.locator(".dashboard-hero").evaluate(hero => { const ring = hero.querySelector(".calorie-ring").getBoundingClientRect(); const copy = hero.querySelector(".balance-copy").getBoundingClientRect(); return ring.right <= copy.left + 1 || ring.left >= copy.right - 1 || ring.bottom <= copy.top + 1 || ring.top >= copy.bottom - 1; })).toBe(true);
    expect(await page.locator("body").evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
    if ([320,390].includes(width)) await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage:true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator(".dashboard-page").evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(1560);
  await expect(page.locator(".dashboard-water")).toHaveCount(0);
});

test("SG034 photo source is a natural sheet with both actions on short screens", async ({page}) => {
  await page.setViewportSize({width:390,height:430});
  await seedAuthenticatedApp(page,{aiAvailable:true});
  await page.goto("/nutricion/registrar");
  await page.getByRole("button",{name:/Registrar comida con foto/i}).click();
  const sheet=page.locator(".picker-source-sheet");
  await expect(sheet).toBeVisible();
  const bounds=await sheet.boundingBox(); expect(bounds.height).toBeLessThan(430);
  for (const name of ["Tomar foto","Elegir foto","Cerrar"]) {
    const button=sheet.getByRole("button",{name,exact:true});
    await expect(button).toBeVisible(); const box=await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.y+box.height).toBeLessThanOrEqual(431);
  }
  await sheet.getByRole("button",{name:"Cerrar",exact:true}).click();
  await expect(page).toHaveURL(/nutricion\/registrar/);
});

test("SG047 correction and saved description keep text and quantity across keyboard frames", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await seedAuthenticatedApp(page,{aiAvailable:true});
  let writes=0;
  const estimate={name:"Prueba teclado",description:"Descripción inicial",confidence:80,items:[{name:"Avena",estimatedGrams:100,proteinGrams:10,carbsGrams:20,fatGrams:5}]};
  await page.route("**/api/nutrition/ai-estimates",async route => {writes++; await route.fulfill({json:{...estimate,usage:{available:true}}});});
  await page.goto("/nutricion/dia");
  await page.getByRole("button",{name:"Agregar alimento a Desayuno",exact:true}).click();
  await page.locator('input[data-photo-source="gallery"]').setInputFiles({name:"meal.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64")});
  await page.getByRole("button",{name:"Analizar foto",exact:true}).click();
  const editor=page.locator(".ai-estimate-modal");
  await expect(editor).toBeVisible();
  await editor.getByText("Corregir o agregar alimentos con IA",{exact:true}).click();
  const correction=editor.getByLabel("Tu corrección",{exact:true});
  await correction.fill("Cambiar los ingredientes. ".repeat(8));
  async function frame(height,offsetTop) {
    await page.evaluate(({height,offsetTop})=>{
      window.__editFrame={height,offsetTop};
      for (const key of ["height","offsetTop"]) Object.defineProperty(window.visualViewport,key,{configurable:true,get:()=>window.__editFrame[key]});
      window.visualViewport.dispatchEvent(new Event("resize"));
    },{height,offsetTop});
    await expect.poll(()=>editor.evaluate(el=>{const header=el.querySelector("header").getBoundingClientRect(),footer=el.querySelector(":scope > footer").getBoundingClientRect(); return header.top >= window.visualViewport.offsetTop-1 && footer.bottom <= window.visualViewport.offsetTop+window.visualViewport.height+1;})).toBe(true);
  }
  await frame(320,92); await expect(correction).toBeFocused();
  const text=await correction.inputValue(); await correction.press("End"); await correction.press("Backspace");
  await frame(280,130); await expect(correction).toHaveValue(text.slice(0,-1));
  const grams=editor.getByLabel("Gramos",{exact:true}).first(); await grams.fill("125"); await expect(grams).toBeFocused();
  await frame(844,0); await expect(grams).toHaveValue("125"); expect(writes).toBe(1);
  await editor.getByRole("button",{name:"Cerrar estimación",exact:true}).click();
  await page.route("**/api/nutrition/dashboard**",route=>route.fulfill({json:{date:"2026-10-01",calorieGoal:2000,caloriesConsumed:165,macros:[],meals:[{mealType:"BREAKFAST",items:[{id:777,itemType:"AI_ESTIMATE",displayName:estimate.name,mealType:"BREAKFAST",logDate:"2026-10-01",calories:165,proteinGrams:10,carbsGrams:20,fatGrams:5,quantity:1,unit:"PORTION",aiEstimateDetails:JSON.stringify(estimate)}]}],nutrients:[]}}));
  await page.reload(); await page.locator(".meal-item").first().click();
  await page.locator(".meal-item-detail-actions").getByRole("button",{name:/Editar/}).click();
  const saved=page.locator(".ai-estimate-modal"); const description=saved.getByLabel("Descripción",{exact:true});
  await description.fill("Descripción revisada con teclado. ".repeat(6)); await frame(320,92);
  await expect(description).toBeFocused(); const savedText=await description.inputValue();
  await frame(844,0); await expect(description).toHaveValue(savedText);
  await expect(saved.getByRole("button",{name:"Guardar cambios",exact:true})).toBeEnabled();
  await saved.getByRole("button",{name:"Cancelar",exact:true}).click(); expect(writes).toBe(1);
});

test("short picker filter area permits touch scrolling without moving the background", async ({page}) => {
 await page.setViewportSize({width:390,height:430});await seedAuthenticatedApp(page);await page.goto("/ingresar");
 await page.getByRole("button",{name:/Agregar alimento a Desayuno/i}).click();
 const tools=page.locator(".picker-tools");
 const touch=await tools.evaluate(element=>{
  const dispatch=(type,y,cancelable=false)=>{const event=new Event(type,{bubbles:true,cancelable});Object.defineProperty(event,"touches",{value:[{clientY:y,clientX:60}]});element.dispatchEvent(event);return event.defaultPrevented;};
  const rect=element.getBoundingClientRect();dispatch("touchstart",rect.top+40);
  return {scrollable:element.scrollHeight>element.clientHeight,blocked:dispatch("touchmove",rect.top+16,true)};
 });
 expect(touch).toEqual({scrollable:true,blocked:false});
 const category=page.locator(".picker-modal").getByLabel("Categoría",{exact:true});await category.focus();
 await expect.poll(()=>category.evaluate(element=>{const control=element.getBoundingClientRect(),owner=element.closest(".picker-tools").getBoundingClientRect();return control.top>=owner.top-1&&control.bottom<=owner.bottom+1;})).toBe(true);
});
