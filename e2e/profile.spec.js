import { test, expect } from "@playwright/test";

async function seedProfileApp(page) {
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
