import { test, expect } from "@playwright/test";

const recipes = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `Receta ${index + 1}`, description: `Preparación ${index + 1}`, calories: 350, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, rawTotalWeightGrams: 300, cookedTotalWeightGrams: 260, ingredients: [{ quantity: 100, unit: "GRAM", food: { id: 200 + index, name: `Ingrediente ${index + 1}`, baseQuantity: 100, calories: 120, proteinGrams: 4, carbsGrams: 20, fatGrams: 3 } }] }));

async function seedRecipes(page, { onDetail, onCopy } = {}) {
  await page.addInitScript(() => {
    history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "recipes" }, "");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body = {};
    if (path === "/api/auth/me") body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    else if (path === "/api/recipes/mine" || path === "/api/recipes/explore/users/7") body = recipes;
    else if (path === "/api/recipes/explore/users") body = [{ id: 7, fullName: "Ana", recipeCount: recipes.length }];
    else if (/^\/api\/recipes\/\d+$/.test(path)) {
      const id = Number(path.split("/").at(-1));
      if (onDetail && await onDetail(route, id)) return;
      body = recipes.find((recipe) => recipe.id === id);
    } else if (path.endsWith("/copy") && request.method() === "POST") {
      onCopy?.();
      body = { id: 99 };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/ingresar");
}

test("opens first and last recipes in a mobile dialog without moving the list", async ({ page }, testInfo) => {
  test.skip(!["webkit-iphone", "webkit-ipad"].includes(testInfo.project.name), "Compact recipe contract");
  await seedRecipes(page);
  const cards = page.locator(".collection-library-select");
  await expect(cards).toHaveCount(20);
  for (const index of [0, 19]) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    const before = await page.locator(".content").evaluate((element) => element.scrollTop);
    await card.click();
    const dialog = page.getByRole("dialog", { name: `Receta ${index + 1}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Ingrediente ${index + 1}`)).toBeVisible();
    await expect(page.locator(".collection-browser-inline-preview")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(card).toBeFocused();
    const after = await page.locator(".content").evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  }
});

test("shows loading immediately and recovers from a recipe detail error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-iphone", "Mobile recipe contract");
  let detailCalls = 0;
  let releaseFirst;
  const firstRequest = new Promise((resolve) => { releaseFirst = resolve; });
  await seedRecipes(page, { onDetail: async (route, id) => {
    if (id !== 1) return false;
    detailCalls += 1;
    if (detailCalls === 1) {
      await firstRequest;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error temporal" }) });
      return true;
    }
    return false;
  } });
  await page.locator(".collection-library-select").first().click();
  const dialog = page.getByRole("dialog", { name: "Receta 1" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Cargando Receta 1")).toBeVisible();
  releaseFirst();
  await expect(dialog.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog.getByText("Ingrediente 1")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".collection-library-select").first()).toBeFocused();
});

test("keeps explored recipe copy inside the mobile detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-iphone", "Mobile recipe contract");
  let copies = 0;
  await seedRecipes(page, { onCopy: () => { copies += 1; } });
  await page.getByRole("tab", { name: "Explorar recetas" }).click();
  await page.getByRole("button", { name: /Ana/ }).click();
  await page.locator(".collection-library-select").first().click();
  const dialog = page.getByRole("dialog", { name: "Receta 1" });
  await dialog.getByRole("button", { name: "Guardar en mis recetas" }).click();
  await expect.poll(() => copies).toBe(1);
  await expect(dialog).toBeVisible();
});

test("switches between dialog and side preview at the compact breakpoint", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Resizable desktop contract");
  await page.setViewportSize({ width: 1200, height: 700 });
  await seedRecipes(page);
  await page.locator(".collection-library-select").first().click();
  await expect(page.getByRole("dialog", { name: "Receta 1" })).toBeVisible();
  await page.setViewportSize({ width: 1201, height: 700 });
  await expect(page.getByRole("dialog", { name: "Receta 1" })).toHaveCount(0);
  await expect(page.locator(".collection-browser-preview")).toBeVisible();
  await page.locator(".collection-library-select").first().click();
  await expect(page.locator(".collection-browser-preview").getByText("Ingrediente 1")).toBeVisible();
  await page.setViewportSize({ width: 1200, height: 700 });
  await expect(page.getByRole("dialog", { name: "Receta 1" })).toHaveCount(0);
});

test("keeps recipe cards readable when the desktop sidebar narrows the content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Resizable desktop contract");
  await page.setViewportSize({ width: 1024, height: 768 });
  await seedRecipes(page);
  const bounds = await page.locator(".collection-library-card").first().evaluate((element) => {
    const card = element.getBoundingClientRect();
    const button = element.querySelector(".collection-library-select");
    return { cardWidth: card.width, copyWidth: button.children[1].getBoundingClientRect().width, buttonScrollWidth: button.scrollWidth, buttonClientWidth: button.clientWidth, cardRight: card.right, viewportWidth: document.documentElement.clientWidth };
  });
  expect(bounds.buttonScrollWidth).toBeLessThanOrEqual(bounds.buttonClientWidth + 1);
  expect(bounds.cardRight).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.copyWidth).toBeGreaterThanOrEqual(120);
});
