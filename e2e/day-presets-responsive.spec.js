import { test, expect } from "@playwright/test";

async function seedAuthenticatedApp(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
    history.replaceState({ scalegramsMode: "nutrition", scalegramsPage: "day-presets" }, "");
  });

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    let body = {};

    if (requestUrl.pathname === "/api/auth/me") {
      body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    } else if (requestUrl.pathname === "/api/nutrition/dashboard") {
      body = {
        date: requestUrl.searchParams.get("date"),
        caloriesConsumed: 0,
        calorieGoal: 2000,
        macros: [],
        meals: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"].map((mealType) => ({ mealType, items: [] })),
        nutrients: [],
        waterConsumed: 0,
        waterGoal: 2,
        plan: null,
      };
    } else if (requestUrl.pathname === "/api/nutrition/day-presets") {
      body = [];
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.describe("Reutilizá tu día responsive", () => {
  test("stacks the date controls vertically on iPhone WebKit", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("webkit-iphone"), "iPhone WebKit contract");

    await seedAuthenticatedApp(page);
    await page.goto("/ingresar");
    const datebar = page.locator(".day-presets-datebar");
    await expect(datebar).toBeVisible();

    const metrics = await datebar.evaluate((element) => {
      const children = Array.from(element.children).map((child) => child.getBoundingClientRect().toJSON());
      const input = element.querySelector("input").getBoundingClientRect().toJSON();
      const bar = element.getBoundingClientRect().toJSON();
      const styles = getComputedStyle(element);
      return {
        children,
        input,
        bar,
        display: styles.display,
        gridTemplateColumns: styles.gridTemplateColumns,
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.display).toBe("grid");
    expect(metrics.children).toHaveLength(3);
    expect(metrics.children[1].top).toBeGreaterThanOrEqual(metrics.children[0].bottom - 1);
    expect(metrics.children[2].top).toBeGreaterThanOrEqual(metrics.children[1].bottom - 1);
    expect(metrics.input.width).toBeLessThanOrEqual(metrics.children[1].width + 1);
    expect(metrics.bar.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  });
});
