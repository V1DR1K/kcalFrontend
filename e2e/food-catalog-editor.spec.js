import { test, expect } from "@playwright/test";

const food = {
  id: 23,
  name: "Cebolla",
  brand: "Fresco",
  barcode: "7790000000233",
  category: "VEGETABLE",
  baseUnit: "GRAM",
  baseQuantity: 100,
  calories: 41.6,
  proteinGrams: 1.1,
  carbsGrams: 9.3,
  fatGrams: 0,
  preparation: "UNSPECIFIED",
  servingName: null,
  servingWeightGrams: null,
  tags: ["Verdura"],
};

async function openFoodsPage(page, role = "ADMIN") {
  let catalogFood = { ...food };
  await page.addInitScript(() => {
    window.history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "my-foods" }, "");
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { id: 1, username: "editor", role, fullName: "Editor" } });
    }
    if (url.pathname === "/api/foods/mine" || url.pathname === "/api/foods/mine/deleted") {
      return route.fulfill({ json: [] });
    }
    if (url.pathname === "/api/foods" && route.request().method() === "GET") {
      const matches = url.searchParams.get("q")?.toLowerCase().includes("cebolla");
      return route.fulfill({ json: { items: matches ? [catalogFood] : [], page: 0, totalPages: 1, hasNext: false } });
    }
    if (url.pathname === "/api/foods/23" && route.request().method() === "GET") {
      return route.fulfill({ json: catalogFood });
    }
    if (url.pathname === "/api/foods/23" && route.request().method() === "PUT") {
      catalogFood = { ...catalogFood, ...route.request().postDataJSON() };
      catalogFood.calories = Math.round(catalogFood.proteinGrams * 4 + catalogFood.carbsGrams * 4 + catalogFood.fatGrams * 9);
      return route.fulfill({ json: catalogFood });
    }
    return route.fulfill({ status: 200, json: {} });
  });
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", { name: "Alimentos" })).toBeVisible();
}

test("admin updates an original food through a JSON PUT without changing the URL", async ({ page }) => {
  await openFoodsPage(page);
  await page.getByRole("tab", { name: "Catálogo original" }).click();
  await page.getByRole("searchbox", { name: "Buscar alimento" }).fill("cebolla");
  await page.getByRole("button", { name: "Editar Cebolla" }).waitFor();
  await page.getByRole("button", { name: "Editar Cebolla" }).click();

  const putRequest = page.waitForRequest((request) => request.url().endsWith("/api/foods/23") && request.method() === "PUT");
  await page.getByRole("textbox", { name: "Carbohidratos g" }).fill("8.4");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const request = await putRequest;

  expect(request.postDataJSON()).toMatchObject({ name: "Cebolla", proteinGrams: 1.1, carbsGrams: 8.4, fatGrams: 0 });
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Alimento actualizado.")).toBeVisible();
  await expect(page.locator(".admin-food-row .nutrition-summary")).toContainText("38");
  await expect(page.locator(".admin-food-row .nutrition-summary")).toContainText("8,4g");
});

test("keeps the editor open and reports a failed PUT", async ({ page }) => {
  await openFoodsPage(page);
  await page.getByRole("tab", { name: "Catálogo original" }).click();
  await page.getByRole("searchbox", { name: "Buscar alimento" }).fill("cebolla");
  await page.getByRole("button", { name: "Editar Cebolla" }).click();
  await page.route("**/api/foods/23", (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "No se pudo actualizar la cebolla." }) })
    : route.continue());

  await page.getByRole("textbox", { name: "Carbohidratos g" }).fill("8.4");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("No se pudo actualizar la cebolla.")).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("does not show the original catalog tab to a regular user", async ({ page }) => {
  await openFoodsPage(page, "USER");
  await expect(page.getByRole("tab", { name: "Catálogo original" })).toHaveCount(0);
});
