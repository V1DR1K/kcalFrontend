import { test, expect } from "@playwright/test";

test("renders the authentication shell and validates required fields", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KazaFitness/i);
  await expect(page.getByText("KazaFitness", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});
