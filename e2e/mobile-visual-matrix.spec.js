import { test, expect } from "@playwright/test";

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
const food = { id: 11, name: "Avena integral", brand: "Campo", category: "CEREAL", baseUnit: "GRAM", baseQuantity: 100, calories: 389, proteinGrams: 16.9, carbsGrams: 66.3, fatGrams: 6.9, preparation: "UNSPECIFIED" };
const recipe = { id: 22, name: "Tostada proteica", description: "Una preparación sencilla para el desayuno.", calories: 350, proteinGrams: 28, carbsGrams: 42, fatGrams: 8, rawTotalWeightGrams: 300, cookedTotalWeightGrams: 260, ingredients: [{ food, quantity: 100, unit: "GRAM" }] };
const trainingPlan = { id: 31, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, active: true, version: 1, days: [{ id: 32, name: "Día A", dayOfWeek: "MONDAY", exercises: [{ id: 33, exerciseId: 34, exerciseName: "Sentadilla", targetSets: 3, targetRepetitions: 8, targetWeightKg: 60 }] }] };

const matrix = [
  { path: "/nutricion/dia", name: "nutrition-day" },
  { path: "/nutricion/plantillas", name: "day-presets" },
  { path: "/nutricion/recetas", name: "recipes" },
  { path: "/nutricion/historial", name: "nutrition-calendar" },
  { path: "/nutricion/planes", name: "nutrition-plans" },
  { path: "/nutricion/alimentos", name: "foods" },
  { path: "/nutricion/registrar", name: "register" },
  { path: "/nutricion/perfil", name: "nutrition-profile" },
  { path: "/entrenamiento/dia", name: "training-day" },
  { path: "/entrenamiento/calendario", name: "training-calendar" },
  { path: "/entrenamiento/cardio", name: "cardio" },
  { path: "/entrenamiento/ejercicios", name: "exercises" },
  { path: "/entrenamiento/planes", name: "training-plans" },
  { path: "/entrenamiento/perfil", name: "training-profile" },
];
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 900, height: 1024 },
  { width: 901, height: 768 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];

async function seedMobileAudit(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body = {};
    if (path === "/api/auth/me") body = { id: 1, username: "mobile-audit", role: "ADMIN", fullName: "Persona de prueba", email: "mobile@example.com" };
    else if (path === "/api/nutrition/dashboard") body = {
      date: url.searchParams.get("date") || todayKey,
      caloriesConsumed: 389,
      calorieGoal: 2200,
      macros: [{ key: "PROTEIN", label: "Proteínas", consumed: 16.9, goal: 140 }, { key: "CARBS", label: "Carbohidratos", consumed: 66.3, goal: 220 }, { key: "FAT", label: "Grasas", consumed: 6.9, goal: 70 }],
      meals: [
        { mealType: "BREAKFAST", label: "Desayuno", calories: 389, items: [{ id: 101, itemType: "FOOD", quantity: 100, unit: "GRAM", calories: 389, proteinGrams: 16.9, carbsGrams: 66.3, fatGrams: 6.9, food }] },
        { mealType: "LUNCH", label: "Almuerzo", calories: 0, items: [] },
        { mealType: "AFTERNOON_SNACK", label: "Merienda", calories: 0, items: [] },
        { mealType: "DINNER", label: "Cena", calories: 0, items: [] },
      ],
      nutrients: [], waterConsumed: 1, waterGoal: 2, plan: { name: "Meta manual" },
    };
    else if (path === "/api/nutrition/meal-types") body = [{ code: "BREAKFAST", label: "Desayuno" }, { code: "LUNCH", label: "Almuerzo" }, { code: "AFTERNOON_SNACK", label: "Merienda" }, { code: "DINNER", label: "Cena" }];
    else if (path === "/api/nutrition/history") body = {
      year: today.getFullYear(), month: today.getMonth() + 1, averageCalories: 1850, averageDayCount: 2, completedGoalDays: 1,
      days: Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, index) => ({
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
        caloriesConsumed: index === 0 || index === today.getDate() - 1 ? 1850 : 0,
        calorieGoal: 2200, proteinGrams: 120, carbsGrams: 180, fatGrams: 55, goalReached: index === 0,
        planId: 7, planName: "Plan base",
      })),
    };
    else if (path === "/api/nutrition/day-presets") body = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1, name: `Día guardado ${index + 1}`, description: "Comidas planificadas para una jornada completa.", itemCount: 4, mealCounts: { BREAKFAST: 1, LUNCH: 1, AFTERNOON_SNACK: 1, DINNER: 1 },
      items: ["Desayuno", "Almuerzo", "Merienda", "Cena"].map((displayName, itemIndex) => ({ itemType: "FOOD", itemId: 11, mealType: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"][itemIndex], quantity: 100, unit: "GRAM", displayName, calories: 250, proteinGrams: 12, carbsGrams: 30, fatGrams: 8 })),
    }));
    else if (path === "/api/recipes/mine" || path === "/api/recipes/explore/users/7" || path === "/api/recipes") body = [recipe];
    else if (path === "/api/recipes/explore/users") body = [{ id: 7, fullName: "Ana de prueba", recipeCount: 1 }];
    else if (path === "/api/recipes/22") body = recipe;
    else if (path === "/api/foods/mine" || path === "/api/foods/mine/deleted") body = [food];
    else if (path === "/api/foods" && request.method() === "GET") body = { items: [food], page: Number(url.searchParams.get("page") || 0), size: 50, totalElements: 1, totalPages: 1, hasNext: false };
    else if (path === "/api/foods/11") body = food;
    else if (path === "/api/profile") body = { id: 1, fullName: "Persona de prueba", email: "mobile@example.com", heightCm: 175, weightKg: 70, dailyCalorieGoal: 2200 };
    else if (path === "/api/profile/weight-entries") body = [{ id: 51, entryDate: todayKey, weightKg: 70 }];
    else if (path === "/api/profile/nutrition-plans") body = [{ id: 61, name: "Plan actual", dailyCalories: 2200, proteinPercent: 25, carbsPercent: 45, fatPercent: 30, status: "SCHEDULED", current: true, startDate: monthStart, version: 1 }];
    else if (path === "/api/nutrition/ai-estimates/usage") body = { available: true, used: 0, dailyLimit: 5 };
    else if (path === "/api/training/dashboard") body = {
      date: todayKey,
      plans: [trainingPlan],
      recentSession: { id: 41, module: "GYM", date: todayKey, title: "Día A", durationMinutes: 45, exercises: [{ exerciseName: "Sentadilla", sets: [{ repetitions: 8, weightKg: 60 }] }] },
      weeklySummary: { sessionCount: 2, totalMinutes: 90, totalSets: 18 },
      exercises: [{ id: 34, name: "Sentadilla", module: "GYM", global: true, editable: false, active: true }],
      plannedPlans: [],
    };
    else if (path === "/api/training/calendar") body = [{ date: todayKey, sessions: [{ id: 41, version: 1, module: "GYM", date: todayKey, title: "Día A", durationMinutes: 45, status: "COMPLETED", exercises: [{ id: 42, exerciseId: 34, exerciseName: "Sentadilla", sets: [{ repetitions: 8, weightKg: 60 }] }] }], plannedPlans: [] }];
    else if (path === "/api/training/sessions" && request.method() === "GET") body = { items: [], page: 0, size: 50, totalElements: 0, totalPages: 0, hasNext: false };
    else if (path === "/api/training/sessions/41") body = { id: 41, version: 1, module: "GYM", date: todayKey, title: "Día A", durationMinutes: 45, status: "COMPLETED", exercises: [{ id: 42, exerciseId: 34, exerciseName: "Sentadilla", sets: [{ repetitions: 8, weightKg: 60 }] }] };
    else if (path === "/api/training/plans" && request.method() === "GET") body = { items: [trainingPlan], page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
    else if (path === "/api/training/plans/31") body = trainingPlan;
    else if (path === "/api/training/categories" && request.method() === "GET") body = { items: [{ id: 35, name: "Piernas", module: "GYM", system: true, editable: false, active: true }], page: 0, size: 100, totalElements: 1, totalPages: 1, hasNext: false };
    else if (path === "/api/training/exercises" && request.method() === "GET") body = { items: [{ id: 34, name: "Sentadilla", module: "GYM", category: "Piernas", categoryId: 35, registrationType: "WEIGHT_AND_REPETITIONS", equipment: "BARBELL", global: true, systemExercise: true, editable: false, active: true }], page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
    else if (path === "/api/training/cardio/summary") body = { equipment: "TREADMILL", thresholdMinutes: 1200, totalDurationMinutes: 35, remainingMinutes: 1165, due: false, totalDistanceKm: 4.95, totalEstimatedSteps: 6600, profileHeightCm: 175, latestService: null };
    else if (path === "/api/training/cardio/weekly") body = { from: monthStart, to: todayKey, totalDistanceKm: 4.95, totalEstimatedSteps: 6600, stepsAvailable: true, days: [] };
    else if (path === "/api/training/cardio/services") body = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false };
    else if (path === "/api/training/cardio") body = { items: [{ id: 71, equipment: "TREADMILL", recordedAt: `${todayKey}T10:00:00Z`, distanceKm: 4.95, durationMinutes: 35, inclined: true, speedKmh: 8.5, estimatedSteps: 6600 }], page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("authenticated screens stay readable across the responsive width matrix", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await seedMobileAudit(page);
  for (const screen of matrix) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(screen.path);
      await expect(page.locator(".app-shell")).toBeVisible();
      await expect(page.locator("main.content")).toBeVisible();
      await expect(page.locator("main.content > .page").first()).toBeVisible();
      await page.waitForFunction(() => !document.querySelector(".skeleton, [aria-busy='true']"), null, { timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const nav = document.querySelector(".mobile-nav");
        const navRect = nav?.getBoundingClientRect();
        const shellRect = document.querySelector(".app-shell")?.getBoundingClientRect();
        const clippedLabels = [...(nav?.querySelectorAll(".mobile-primary-items button") || [])].flatMap((control) => {
          const text = control.lastChild;
          if (text?.nodeType !== Node.TEXT_NODE) return [];
          const range = document.createRange();
          range.selectNodeContents(text);
          const label = range.getBoundingClientRect();
          const bounds = control.getBoundingClientRect();
          return label.left >= bounds.left - 1 && label.right <= bounds.right + 1 ? [] : [{ text: text.textContent, label: { left: label.left, right: label.right, width: label.width }, button: { left: bounds.left, right: bounds.right, width: bounds.width }, font: getComputedStyle(control).font }];
        });
        return {
          viewportWidth: width,
          pageWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          mainRight: document.querySelector("main.content")?.getBoundingClientRect().right || 0,
          navVisible: Boolean(nav && getComputedStyle(nav).display !== "none"),
          navBottom: navRect?.bottom || 0,
          shellBottom: shellRect?.bottom || 0,
          clippedLabels,
          planActions: [...document.querySelectorAll(".plans-page .current-plan-actions > .plan-history-actions > button")].map((button) => {
            const rect = button.getBoundingClientRect();
            const parent = button.parentElement.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, width: rect.width, parentWidth: parent.width, height: rect.height };
          }),
          compactHistory: (() => {
            const day = document.querySelector(".history-page .history-calendar-day[data-calendar-state='recorded']");
            if (!day) return null;
            return {
              stateLabelDisplay: getComputedStyle(day.querySelector(".history-day-state")).display,
              marker: getComputedStyle(day, "::after").content,
              accessibleLabel: day.getAttribute("aria-label"),
              hasTodaySemantics: Boolean(document.querySelector(".history-calendar-day[aria-current='date']")),
            };
          })(),
          calendarTitle: (() => {
            const title = document.querySelector(".history-calendar-heading h2, .training-calendar-heading h2");
            return title ? { scrollWidth: title.scrollWidth, clientWidth: title.clientWidth } : null;
          })(),
          trainingPlanBounds: (() => {
            const panel = document.querySelector(".training-plan-manager");
            const item = panel?.querySelector(".training-plan-current-item");
            if (!panel || !item) return null;
            const panelRect = panel.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            return { panelRight: panelRect.right, itemRight: itemRect.right, panelWidth: panel.clientWidth, itemWidth: item.clientWidth, itemScrollWidth: item.scrollWidth };
          })(),
        };
      });
      expect(metrics.pageWidth, `${screen.name} at ${viewport.width}x${viewport.height}: document overflow`).toBeLessThanOrEqual(viewport.width + 1);
      expect(metrics.bodyWidth, `${screen.name} at ${viewport.width}x${viewport.height}: body overflow`).toBeLessThanOrEqual(viewport.width + 1);
      if (viewport.width <= 900) {
        expect(metrics.navVisible, `${screen.name} at ${viewport.width}: mobile navigation hidden`).toBe(true);
        expect(metrics.clippedLabels, `${screen.name} at ${viewport.width}: clipped mobile navigation labels`).toEqual([]);
        expect(Math.abs(metrics.navBottom - metrics.shellBottom), `${screen.name} at ${viewport.width}: bottom navigation detached`).toBeLessThanOrEqual(1);
      } else {
        expect(metrics.navVisible, `${screen.name} at ${viewport.width}: desktop navigation did not take over`).toBe(false);
      }
      if (screen.name === "nutrition-plans" && viewport.width <= 560) {
        expect(metrics.planActions.length, "nutrition plan actions should all be present").toBeGreaterThanOrEqual(2);
        expect(metrics.planActions.every((button) => button.width <= button.parentWidth + 1 && button.height >= 44), "nutrition plan action buttons should fit their row and meet the touch target").toBe(true);
        expect(metrics.planActions.slice(1).every((button, index) => button.top >= metrics.planActions[index].bottom - 1), "nutrition plan actions should not overlap").toBe(true);
      }
      if (screen.name === "nutrition-calendar" && viewport.width <= 560) {
        expect(metrics.compactHistory.stateLabelDisplay, "calendar state words should not overflow narrow day cells").toBe("none");
        expect(metrics.compactHistory.marker, "registered days should have a compact state marker").toBe("\"✓\"");
        expect(metrics.compactHistory.accessibleLabel.toLowerCase(), "calendar state should remain available to assistive technology").toContain("registrado");
        expect(metrics.compactHistory.hasTodaySemantics, "the current day should retain its date semantics").toBe(true);
      }
      if (["nutrition-calendar", "training-calendar"].includes(screen.name) && viewport.width <= 560) {
        expect(metrics.calendarTitle.scrollWidth, `${screen.name} month title should fit between the navigation controls`).toBeLessThanOrEqual(metrics.calendarTitle.clientWidth + 1);
      }
      if (screen.name === "training-plans" && viewport.width <= 560) {
        expect(metrics.trainingPlanBounds.itemRight, "the active training plan card should fit inside its panel").toBeLessThanOrEqual(metrics.trainingPlanBounds.panelRight + 1);
        expect(metrics.trainingPlanBounds.itemScrollWidth, "the active training plan card content should fit without clipping").toBeLessThanOrEqual(metrics.trainingPlanBounds.itemWidth + 1);
      }
      if (viewport.width === 320 || viewport.width === 1024) {
        await page.screenshot({ path: testInfo.outputPath(`${screen.name}-${viewport.width}.png`), fullPage: true });
      }
    }
  }
});
