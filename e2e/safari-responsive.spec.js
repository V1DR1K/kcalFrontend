import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page) {
  await page.addInitScript(() => {
    history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "dashboard" }, "");
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/api/auth/me") {
      body = { id: 1, fullName: "Persona Safari", email: "safari@example.com" };
    } else if (url.pathname === "/api/nutrition/dashboard") {
      body = {
        date: "2026-09-18",
        caloriesConsumed: 0,
        calorieGoal: 2000,
        macros: [],
        meals: [],
        nutrients: [],
        waterConsumed: 0,
        waterGoal: 2,
        plan: null,
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.describe("Safari responsive contract", () => {
  test.skip(({ browserName }) => browserName !== "webkit", "Safari/WebKit contract");

  test("landing has no horizontal overflow and keeps the primary action reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    await expect(page.getByRole("link", { name: /Empezar|Ingresar/i }).first()).toBeVisible();
  });

  test("login surface respects the viewport contract", async ({ page }) => {
    await page.goto("/ingresar");
    await expect(page.locator("body")).toBeVisible();
    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: window.visualViewport?.height || window.innerHeight,
      appHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim(),
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.viewportHeight).toBeGreaterThan(0);
    expect(metrics.appHeight).toMatch(/px$/);
  });

  test("short iPhone viewport keeps the shell inside the visual viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "webkit-iphone-short", "Dedicated short iPhone viewport project");
    await page.goto("/ingresar");
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      visualHeight: window.visualViewport?.height || window.innerHeight,
    }));
    expect(metrics.width).toBe(390);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.innerHeight).toBeLessThanOrEqual(metrics.visualHeight + 1);
    expect(metrics.visualHeight).toBeLessThanOrEqual(430 + 1);
  });

  test("authenticated mobile navigation stays attached to the viewport bottom", async ({ page }) => {
    await seedAuthenticatedApp(page);
    await page.goto("/ingresar");

    const mobileNav = page.locator(".mobile-nav");
    await expect(mobileNav).toBeVisible();
    const layout = await mobileNav.evaluate((element) => {
      const shell = element.closest(".app-shell").getBoundingClientRect();
      const nav = element.getBoundingClientRect();
      const button = element.querySelector("button").getBoundingClientRect();
      const viewportBottom = window.visualViewport?.height || window.innerHeight;
      return {
        navBottom: nav.bottom,
        shellBottom: shell.bottom,
        viewportBottom,
        buttonHeight: button.height,
      };
    });

    expect(Math.abs(layout.navBottom - layout.shellBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.navBottom - layout.viewportBottom)).toBeLessThanOrEqual(1);
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
  });
});
