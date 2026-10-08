import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

function currentMonth() {
  const date = new Date();
  return { year: date.getFullYear(), month: date.getMonth() + 1, monthName: new Intl.DateTimeFormat("es-AR", { month: "long" }).format(date) };
}

function dateKey(day) {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function seedHistoryApp(page, { startOnHistory = false } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  if (startOnHistory) await page.addInitScript(() => history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "history" }, ""));
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    let body = {};
    if (requestUrl.pathname === "/api/auth/me") body = { id: 1, fullName: "Persona Historial", email: "historial@example.com" };
    if (requestUrl.pathname === "/api/nutrition/history") {
      body = {
        year: currentMonth().year,
        month: currentMonth().month,
        averageCalories: 1850,
        completedGoalDays: 1,
        days: Array.from({ length: new Date(currentMonth().year, currentMonth().month, 0).getDate() }, (_, index) => ({
          date: dateKey(index + 1),
          caloriesConsumed: index === 2 ? 1850 : 0,
          calorieGoal: 2000,
          proteinGrams: index === 2 ? 120 : 0,
          carbsGrams: index === 2 ? 180 : 0,
          fatGrams: index === 2 ? 55 : 0,
          goalReached: index === 2,
          planId: 7,
          planName: "Plan base",
        })),
      };
    }
    if (requestUrl.pathname === "/api/nutrition/dashboard") body = {
      date: requestUrl.searchParams.get("date"),
      caloriesConsumed: 1850,
      calorieGoal: 2000,
      macros: [
        { key: "PROTEIN", label: "Proteínas", consumed: 120, goal: 140 },
        { key: "CARBS", label: "Carbohidratos", consumed: 180, goal: 220 },
        { key: "FAT", label: "Grasas", consumed: 55, goal: 65 },
      ],
      meals: [{ mealType: "BREAKFAST", label: "Desayuno", calories: 400, items: [{ id: 101, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 400, proteinGrams: 20, carbsGrams: 50, fatGrams: 8, food: { name: "Avena", category: "CEREAL" } }] }],
      waterConsumed: 1.5,
      waterGoal: 2,
      plan: { name: "Plan base" },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("opens nutrition calendar day detail and exports XLS", async ({ page }) => {
  await seedHistoryApp(page, { startOnHistory: true });
  await page.goto("/ingresar");

  const month = currentMonth();
  await expect(page.getByRole("heading", { name: "Calendario", exact: true })).toBeVisible();
  await expect(page.locator(".history-calendar-surface")).toBeVisible();
  await expect(page.locator(".history-calendar-day")).toHaveCount(new Date(month.year, month.month, 0).getDate());
  await expect(page.getByText("1 día registrado", { exact: true })).toBeVisible();

  const detailRequest = page.waitForRequest((request) => request.url().includes(`/api/nutrition/dashboard?date=${dateKey(3)}`));
  await page.locator(`[data-history-date="${dateKey(3)}"]`).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await detailRequest).url()).toContain(dateKey(3));
  await expect(page.getByRole("dialog").getByText("Avena", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: /Exportar a Excel/ }).click();
  await expect(page.getByRole("heading", { name: "Exportar comidas", exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar Excel", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`scalegrams-comidas-${month.year}-${String(month.month).padStart(2, "0")}.xls`);
});

test("keeps the history calendar usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedHistoryApp(page, { startOnHistory: true });
  await page.goto("/ingresar");
  await expect(page.locator(".history-calendar-surface")).toBeVisible();

  const layout = await page.locator(".history-calendar-surface").evaluate((surface) => {
    const grid = surface.querySelector(".history-calendar-grid");
    const rect = surface.getBoundingClientRect();
    const history = surface.closest(".history-page");
    return {
      surfaceRight: rect.right,
      viewport: window.innerWidth,
      gridOverflow: grid.scrollWidth > grid.clientWidth,
      actionSize: surface.querySelector(".history-calendar-icon-action").getBoundingClientRect().height,
      daySize: surface.querySelector(".history-calendar-day").getBoundingClientRect().height,
      calendarTop: rect.top,
      summaryTop: history.querySelector(".history-summary").getBoundingClientRect().top,
    };
  });
  expect(layout.surfaceRight).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.gridOverflow).toBe(false);
  expect(layout.actionSize).toBeGreaterThanOrEqual(44);
  expect(layout.daySize).toBeGreaterThanOrEqual(44);
  expect(layout.calendarTop).toBeLessThan(layout.summaryTop);
});

test("SG019–021 distinguishes zero, partial and missing records and preserves unknown exported values", async ({ page }) => {
  await seedHistoryApp(page, { startOnHistory: true });
  const now = new Date(); const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const empty = { date: dateKey(1), caloriesConsumed: 0, recordCount: 0, recordState: "NONE", goalReached: false };
  const partial = { date: day, caloriesConsumed: 0, recordCount: 1, recordState: "PARTIAL", energyComplete: false, goalReached: false };
  await page.route("**/api/nutrition/history**", route => route.fulfill({ json: { days: [partial], averageCalories: null, averageDayCount: 0, completedGoalDays: 0 } }));
  await page.route("**/api/nutrition/dashboard**", route => route.fulfill({ json: { date: day, energyComplete: false, meals: [{ mealType:"BREAKFAST", label:"Desayuno", items:[{ id:1, itemType:"FOOD", quantity:100, unit:"GRAM", calories:null, proteinGrams:null, carbsGrams:0, fatGrams:0, food:{name:"Sin composición"} }] }] } }));
  await page.goto("/ingresar");
  await expect(page.getByText("Sin datos suficientes", { exact:true })).toBeVisible();
  await expect(page.locator(`[data-history-date="${day}"]`)).toHaveAccessibleName(/Calorías incompletas/);
  await page.getByRole("button", { name:/Exportar a Excel/ }).click();
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name:"Descargar Excel", exact:true }).click();
  const download = await downloadPromise; const contents = await readFile(await download.path(), "utf8");
  expect(contents).toContain("Sin composición"); expect(contents).toContain("<td>Sin dato</td><td>Sin dato</td><td>0</td><td>0</td>");
  await page.route("**/api/nutrition/history**", route => route.fulfill({ json: { days:[empty], averageCalories:null, completedGoalDays:0 } }));
  await page.reload();
  await expect(page.getByRole("button", { name:/Exportar a Excel/ })).toBeDisabled();
  await expect(page.locator(`[data-history-date="${empty.date}"]`)).toHaveAccessibleName(/Sin registros/);
});
