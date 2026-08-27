import { test, expect } from "@playwright/test";

test("renders the public landing and links to account access", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ScaleGrams/i);
  await expect(page.getByRole("heading", { name: /tu plan se entiende/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /ingresar a scalegrams/i })).toHaveAttribute("href", "/ingresar");
});

test("keeps public access controls touch-safe and allows browser zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const access = page.locator(".landing-header").getByRole("link", { name: "Ingresar", exact: true });
  await expect(access).toBeVisible();
  expect((await access.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(access).toHaveCSS("touch-action", "pan-x pan-y");
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute("content", /user-scalable=no/);
});

test("renders account access with a route-specific title and return path", async ({ page }) => {
  await page.goto("/ingresar");
  await expect(page).toHaveTitle("Ingresar | ScaleGrams");
  await expect(page.getByText("ScaleGrams", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Usuario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /volver a scalegrams/i })).toHaveAttribute("href", "/");
});

test("announces a recoverable authentication error", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message: "Email o contraseña incorrectos." }),
  }));
  await page.goto("/ingresar");
  await page.getByRole("textbox", { name: "Usuario" }).fill("persona");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert")).toContainText("Email o contraseña incorrectos.");
});
