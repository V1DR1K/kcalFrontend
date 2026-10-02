import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("SG032–033 legible inputs, metadata and AA contrast at account access", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", {level:1})).toBeVisible();
  for (const input of await page.locator("input").all()) expect(parseFloat(await input.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const results = await new AxeBuilder({page}).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("SG032–033 dashboard typography and contrast preserve mobile layout", async ({ page }) => {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    const json = path === "/api/auth/me" ? {id:1,username:"alex"} : path === "/api/nutrition/dashboard" ? {
      date:new URL(route.request().url()).searchParams.get("date"), calorieGoal:2000, caloriesConsumed:0, waterConsumed:0, waterGoal:2,
      macros:[{key:"PROTEIN",label:"Proteínas",goal:150,consumed:0},{key:"CARBS",label:"Carbohidratos",goal:200,consumed:0},{key:"FAT",label:"Grasas",goal:65,consumed:0}],
      meals:[{mealType:"BREAKFAST",label:"Desayuno",items:[],calories:0},{mealType:"LUNCH",label:"Almuerzo",items:[],calories:0},{mealType:"DINNER",label:"Cena",items:[],calories:0}], nutrients:[]
    } : [];
    return route.fulfill({json});
  });
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    await page.goto("/nutricion/dia");
    await expect(page.locator(".macro-card")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator(".dashboard-page").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const violations = (await new AxeBuilder({page}).withTags(["wcag2aa"]).analyze()).violations;
    expect(violations).toEqual([]);
    const nav = page.locator(width <= 900 ? ".mobile-primary-items button" : ".sidebar nav button").first();
    expect(parseFloat(await nav.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  }
});

test("published revision is a real JSON artifact", async ({request}) => {
 const response=await request.get("/version.json"); expect(response.ok()).toBe(true);
 const version=await response.json(); expect(version.revision).toMatch(/^[a-f0-9]{7,40}$/); expect(Date.parse(version.buildTime)).toBeGreaterThan(0);
});
