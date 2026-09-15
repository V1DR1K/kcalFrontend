import { test, expect } from "@playwright/test";

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
});
