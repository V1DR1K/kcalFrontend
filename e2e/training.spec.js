import { test, expect } from "@playwright/test";

function compactNavigation(page) { return (page.viewportSize()?.width || 0) <= 900; }

async function enterTraining(page) {
  await page.getByRole("button", { name: "Entreno", exact: true }).first().click();
}

async function openTrainingSection(page, label) {
  if (compactNavigation(page) && ["Planes", "Ejercicios"].includes(label)) {
    await page.getByRole("button", { name: "Más opciones" }).click();
    await page.locator(".mobile-secondary-items").getByRole("button", { name: label, exact: true }).click();
  } else {
    await page.getByRole("button", { name: label, exact: true }).first().click();
  }
}

async function seedTrainingApp(page, { planned = false, exerciseOnSecondPage = false, hasPlan = true, totalMinutes = 90, calendarDays = [] } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem("scalegrams.token");
    localStorage.removeItem("scalegrams.refreshToken");
    localStorage.removeItem("scalegrams.user");
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    let body = {};
    if (url.includes("/api/auth/me")) body = { id: 1, fullName: "Persona E2E", email: "e2e@example.com" };
    if (url.includes("/api/training/dashboard")) body = { date: "2026-08-26", plans: hasPlan ? [{ id: 1, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, active: true }] : [], recentSession: { id: 1, module: "GYM", date: "2026-08-26", title: "Fuerza base", durationMinutes: 45, exercises: [{ exerciseName: "Sentadilla", sets: [{ repetitions: 5, weightKg: 80 }] }] }, weeklySummary: { sessionCount: 2, totalMinutes, totalSets: 18 }, exercises: [{ id: 1, name: "Sentadilla", module: "GYM", global: true, editable: false, active: true }], plannedPlans: planned ? [{ planId: 1, planDayId: 11, module: "GYM", planDayName: "Fuerza", recommended: true }] : [] };
    if (url.includes("/api/training/calendar")) body = calendarDays;
    if (url.endsWith("/api/training/sessions")) body = { id: 20, version: 1, status: "IN_PROGRESS", module: "GYM", date: "2026-08-26", exercises: [] };
    if (url.includes("/api/training/sessions/20/complete")) body = { id: 20, version: 2, status: "COMPLETED", module: "GYM", date: "2026-08-26", exercises: [] };
    if (url.includes("/api/training/plans/1")) body = { id: 1, name: "Fuerza base", module: "GYM", frequencyMode: "FIXED", targetSessionsPerWeek: 3, days: [{ id: 11, name: "Fuerza", dayOfWeek: "WEDNESDAY", exercises: [{ id: 101, exerciseId: 1, exerciseName: "Sentadilla", targetSets: 4, targetRepetitions: 5, targetWeightKg: 80 }] }] };
    if (url.includes("/api/training/categories")) body = { items: [{ id: 10, name: "Piernas", module: "GYM", system: true, editable: false, active: true }], page: 0, size: 100, totalElements: 1, totalPages: 1, hasNext: false };
    if (method === "POST" && url.endsWith("/api/training/exercises")) {
      const request = route.request().postDataJSON();
      body = { id: 99, name: request.name, module: request.module, category: "Piernas", categoryId: 10, registrationType: "WEIGHT_AND_REPETITIONS", equipment: "NONE", global: true, systemExercise: true, editable: false, active: true };
    } else if (url.includes("/api/training/exercises")) {
      const pageNumber = Number(new URL(url).searchParams.get("page") || 0);
      const query = (new URL(url).searchParams.get("q") || "").toLocaleLowerCase();
      if (query && !["sentadilla", "remo persistido"].some((term) => query.includes(term))) {
        body = { items: [], page: 0, size: 50, totalElements: 0, totalPages: 0, hasNext: false };
      } else {
      const pagedItems = pageNumber === 0
        ? [{ id: 1, name: "Sentadilla", module: "GYM", category: "Piernas", categoryId: 10, registrationType: "REPETITIONS", equipment: "BARBELL", global: true, systemExercise: true, editable: false, active: true }]
        : [{ id: 2, name: "Remo persistido", module: "GYM", category: "Espalda", categoryId: 10, registrationType: "REPETITIONS", equipment: "BARBELL", global: false, systemExercise: false, editable: true, active: true }];
      body = exerciseOnSecondPage ? { items: pagedItems, page: pageNumber, size: 50, totalElements: 2, totalPages: 2, hasNext: pageNumber === 0 } : { items: pagedItems.slice(0, 1), page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false };
      }
    }
    if (url.endsWith("/api/profile")) body = { id: 1, fullName: "Persona E2E", weightKg: 70, heightCm: 175, dailyCalorieGoal: 2200 };
    if (url.includes("/nutrition/dashboard")) body = { date: "2026-08-26", caloriesConsumed: 0, calorieGoal: 2000, macros: [], meals: [], waterConsumed: 0, waterGoal: 2, plan: null };
    if (url.includes("/nutrition/meal-types")) body = [];
    if (url.includes("/nutrition/day-presets")) body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("shows a full zero-duration value in the weekly training summary on narrow mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seedTrainingApp(page, { totalMinutes: 0 });
  await page.addInitScript(() => history.replaceState({ scalegramsMode: "training", scalegramsPage: "training-dashboard" }, ""));
  await page.goto("/ingresar");
  const duration = page.locator(".training-week-values > div:nth-child(2) strong");
  await expect(duration).toHaveText("0 min");
  const bounds = await duration.evaluate((element) => ({ width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, parentWidth: element.parentElement.clientWidth }));
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.parentWidth + 1);
});

test("swaps the nutrition shell for training and restores nutrition with browser history", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await expect(page.getByRole("heading", { name: "Día", exact: true })).toBeVisible();
  const nutritionSwitchLabel = compactNavigation(page) ? "Nutri" : "Nutrición";
  await expect(page.getByRole("button", { name: nutritionSwitchLabel, exact: true }).first()).toBeVisible();
  if (compactNavigation(page)) {
    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect(page.locator(".mobile-secondary-items").getByRole("button", { name: "Ejercicios", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("button", { name: "Ejercicios", exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Ver calendario", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Iniciar (gimnasio|calistenia)/i })).toHaveCount(0);
  await expect(page.getByText("Planes guardados", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Últimos 7 días", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Última sesión", exact: true })).toBeVisible();
  await page.getByRole("button", { name: nutritionSwitchLabel, exact: true }).first().click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-app-mode", "nutrition");
  await expect(page.locator(".dashboard-page")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-app-mode", "training");
  await expect(page.getByRole("heading", { name: "Últimos 7 días", exact: true })).toBeVisible();
});

test("keeps training calendar states and day details readable on a narrow iPhone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-iphone", "Narrow mobile calendar contract");
  await page.setViewportSize({ width: 320, height: 568 });
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  await seedTrainingApp(page, { calendarDays: [{ date, sessions: [], plannedPlans: [{ planId: 1, planDayId: 11, module: "GYM", planName: "Fuerza base", planDayName: "Fuerza", sessionStatus: "IN_PROGRESS" }] }] });
  await page.goto("/ingresar");
  await enterTraining(page);
  await page.getByRole("button", { name: "Agenda", exact: true }).click();

  const calendar = page.locator(".training-calendar-surface");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator(".training-calendar-legend")).toBeVisible();
  const metrics = await calendar.evaluate((surface) => {
    const grid = surface.querySelector(".training-calendar-grid");
    const day = surface.querySelector('[data-calendar-state="in-progress"]');
    const legend = surface.querySelector(".training-calendar-legend");
    return {
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      gridWidth: grid.scrollWidth,
      gridClientWidth: grid.clientWidth,
      dayHeight: day.getBoundingClientRect().height,
      legendFontSize: Number.parseFloat(getComputedStyle(legend.firstElementChild).fontSize),
      labels: [...legend.children].map((item) => item.textContent.trim()),
    };
  });
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.gridWidth).toBeLessThanOrEqual(metrics.gridClientWidth + 1);
  expect(metrics.dayHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.legendFontSize).toBeGreaterThanOrEqual(12);
  expect(metrics.labels).toEqual(["En proceso", "Finalizado", "Planificado", "Registrado"]);

  await calendar.getByRole("button", { name: /En proceso/ }).click();
  const detail = page.locator(".training-session-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute("data-mobile-dialog-font-scale", "true");
  await expect(detail.locator(".modal-shell-header .icon-button")).toBeVisible();
  const dialogMetrics = await detail.evaluate((dialog) => ({
    width: dialog.getBoundingClientRect().width,
    scrollWidth: dialog.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    footerBottom: dialog.querySelector(":scope > footer").getBoundingClientRect().bottom,
    viewportHeight: window.visualViewport?.height || window.innerHeight,
  }));
  expect(dialogMetrics.scrollWidth).toBeLessThanOrEqual(dialogMetrics.width + 1);
  expect(dialogMetrics.width).toBeLessThanOrEqual(dialogMetrics.viewportWidth + 1);
  expect(dialogMetrics.footerBottom).toBeLessThanOrEqual(dialogMetrics.viewportHeight + 1);
});

test("opens a gym session editor from the training dashboard", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await page.getByRole("button", { name: "Registrar sesión libre", exact: true }).click();
  await page.getByRole("button", { name: /Gimnasio/ }).last().click();
  await expect(page.getByRole("heading", { name: /Editar gimnasio/i })).toBeVisible();
  await expect(page.getByText("Autoguardado activo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
});

test("creates a missing exercise from the session exercise combobox", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await page.getByRole("button", { name: "Registrar sesión libre", exact: true }).click();
  await page.getByRole("button", { name: /Gimnasio/ }).last().click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "Agregar", exact: true }).click();
  await editor.getByRole("combobox", { name: "Ejercicio persistido" }).fill("Ejercicio de sesión nuevo");
  await expect(page.getByRole("button", { name: /Agregar "Ejercicio de sesión nuevo" como global/ })).toBeVisible();
  await page.getByRole("button", { name: /Agregar "Ejercicio de sesión nuevo" como global/ }).click();

  const globalDialog = page.getByRole("dialog").filter({ hasText: "Nuevo ejercicio global" }).last();
  await expect(globalDialog).toBeVisible();
  await globalDialog.getByLabel("Categoría base").selectOption("10");
  const createRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/training/exercises"));
  await globalDialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  expect((await createRequest).postDataJSON()).toMatchObject({ name: "Ejercicio de sesión nuevo", module: "GYM", global: true });
  await expect(editor.locator(".training-combobox-selected").getByText("Ejercicio de sesión nuevo", { exact: true })).toBeVisible();
});

test("creates a planned session before opening it and can finish it", async ({ page }) => {
  await seedTrainingApp(page, { planned: true });
  await page.goto("/ingresar");
  await enterTraining(page);
  const createRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/training/sessions"));
  await page.getByRole("button", { name: "Comenzar sesión", exact: true }).click();
  expect((await createRequest).postDataJSON()).toEqual({ date: "2026-08-26", module: "GYM", planId: 1, planDayId: 11 });
  await expect(page.getByRole("heading", { name: /Editar gimnasio/i })).toBeVisible();
  await expect(page.getByText("Sentadilla", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
  const completeRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/complete"));
  await page.getByRole("button", { name: "Finalizar sesión", exact: true }).click();
  await expect((await completeRequest).postDataJSON()).toEqual({ version: 1, persistPlanChanges: false });
});

test("keeps a long plan scrollable and does not show plan descriptions", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Planes");
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nuevo plan", exact: true })).toBeVisible();
  await expect(dialog.getByText("Descripción", { exact: true })).toHaveCount(0);
  for (let index = 0; index < 8; index += 1) await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await expect.poll(() => dialog.locator(".modal-shell-content").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test("uses persisted categories and a searchable persisted exercise selector", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Ejercicios");
  await page.getByText(/Administrar categorías/).click();
  await expect(page.getByRole("heading", { name: "Categorías", exact: true })).toBeVisible();
  await expect(page.getByText("Piernas", { exact: true })).toBeVisible();
  await openTrainingSection(page, "Planes");
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Día 1", exact: true })).toBeVisible();
  const picker = dialog.getByRole("combobox", { name: "Buscar ejercicio" });
  await picker.fill("Sentadilla");
  await expect(page.getByRole("option", { name: /Sentadilla.*Base/ })).toBeVisible();
  await page.getByRole("option", { name: /Sentadilla.*Base/ }).click();
  await expect(dialog.locator(".training-plan-exercise-copy").getByText("Sentadilla", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Volver al plan", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Nuevo plan", exact: true })).toBeVisible();
  await expect(dialog.locator(".training-plan-day-summary").getByText(/Sentadilla/)).toBeVisible();
});

test("loads every exercise page before filtering the plan day picker", async ({ page }) => {
  await seedTrainingApp(page, { exerciseOnSecondPage: true });
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Planes");
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Buscar ejercicio" }).fill("Remo persistido");
  await expect(page.getByRole("option", { name: /Remo persistido.*Personal/ })).toBeVisible();
  await expect(dialog.getByText("Cargar más ejercicios", { exact: true })).toHaveCount(0);
});

test("creates a missing exercise globally from the plan day picker", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Planes");
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const planDialog = page.getByRole("dialog").first();
  await planDialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await planDialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  const picker = planDialog.getByRole("combobox", { name: "Buscar ejercicio" });
  await picker.fill("Ejercicio global nuevo");
  await expect(planDialog.getByRole("button", { name: /Agregar "Ejercicio global nuevo" como global/ })).toBeVisible();

  await planDialog.getByRole("button", { name: /Agregar "Ejercicio global nuevo" como global/ }).click();
  const globalDialog = page.getByRole("dialog").filter({ hasText: "Nuevo ejercicio global" }).last();
  await expect(globalDialog).toBeVisible();
  await globalDialog.getByLabel("Categoría base").selectOption("10");
  const createRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/training/exercises"));
  await globalDialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  expect((await createRequest).postDataJSON()).toMatchObject({ name: "Ejercicio global nuevo", module: "GYM", global: true });
  await expect(planDialog.locator(".training-plan-exercise-copy").getByText("Ejercicio global nuevo", { exact: true })).toBeVisible();
});

test("shows only training plans in training mode", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Planes");
  await expect(page.getByRole("heading", { name: "Planes de entrenamiento", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan alimenticio", exact: true })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/api/profile/nutrition-plans"))).toBe(false);
});

test("guides a person without a plan to create one while keeping a free session available", async ({ page }) => {
  await seedTrainingApp(page, { hasPlan: false });
  await page.goto("/ingresar");
  await enterTraining(page);
  await expect(page.getByRole("button", { name: "Crear plan", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sesión libre", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Crear plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Planes de entrenamiento", exact: true })).toBeVisible();
});

test("keeps training actions and exercise options inside a reduced mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await openTrainingSection(page, "Planes");
  await page.locator(".training-plan-manager").getByRole("button", { name: "Agregar plan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Agregar día", exact: true }).click();
  await dialog.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Buscar ejercicio" }).fill("Sentadilla");

  const option = page.getByRole("option", { name: /Sentadilla.*Base/ });
  await expect(option).toBeVisible();
  const bounds = await page.evaluate(() => {
    const getBounds = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      viewport: window.innerHeight,
      surface: getBounds("[data-dialog-surface=\"true\"]"),
      content: getBounds("[data-dialog-surface=\"true\"] > .modal-shell-content"),
      footer: getBounds("[data-dialog-surface=\"true\"] > .modal-shell-footer"),
      list: getBounds(".training-exercise-picker-results"),
      footerPosition: getComputedStyle(document.querySelector("[data-dialog-surface=\"true\"] > .modal-shell-footer")).position,
    };
  });
  expect(bounds.surface.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.footer.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.content.bottom).toBeGreaterThanOrEqual(bounds.footer.bottom - 1);
  expect(bounds.footerPosition).toBe("absolute");
  expect(bounds.list.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.list.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
  await option.click();
});

test("does not render weight fields for calisthenics", async ({ page }) => {
  await seedTrainingApp(page);
  await page.goto("/ingresar");
  await enterTraining(page);
  await page.getByRole("button", { name: "Registrar sesión libre", exact: true }).click();
  await page.getByRole("button", { name: /Calistenia/ }).last().click();
  await expect(page.getByRole("heading", { name: /Editar calistenia/i })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveCount(0);
  await expect(page.getByText("Agregá un ejercicio para comenzar la sesión.", { exact: true })).toBeVisible();
});

test("SG024–026 shows the first result above category administration and readable distinct filters", async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await seedTrainingApp(page);
  await page.route("**/api/training/categories**", route => route.fulfill({json:{items:[{id:10,name:"ABDOMEN",module:"GYM",system:true,active:true},{id:11,name:"ABDOMEN",module:"CALISTHENICS",system:true,active:true}]}}));
  await page.route("**/api/training/exercises**", route => route.fulfill({json:{items:[{id:1,name:"Pedaleo",category:"CUERPO_COMPLETO",module:"GYM",registrationType:"TIME",equipment:"STATIONARY_BIKE",editable:false,systemExercise:true}],hasNext:false}}));
  await page.addInitScript(() => history.replaceState({scalegramsMode:"training",scalegramsPage:"training-profile"}, "")); await page.goto("/ingresar");
  const result = page.locator(".training-exercise-card").first(); await expect(result).toContainText("Bicicleta fija"); await expect(result).toContainText("Cuerpo completo");
  expect((await result.boundingBox()).y).toBeLessThan(600);
  await page.locator(".training-filter-disclosure > summary").click();
  const category = page.getByLabel("Categoría",{exact:true}); await expect(category.locator("option")).toHaveText(["Todas las categorías","Abdomen · Gimnasio · Base","Abdomen · Calistenia · Base"]);
  await category.selectOption("11"); await expect(page.locator(".training-active-filters")).toContainText("Calistenia");
  await page.getByRole("button",{name:"Limpiar búsqueda y filtros"}).click(); await expect(category).toHaveValue("");
});

test("SG042 serializes delayed saves and compares a second client's conflict", async ({page}) => {
  const other = await page.context().newPage();
  let server={id:20,version:0,status:"IN_PROGRESS",module:"GYM",date:"2026-10-01",title:"Compartida",exercises:[{id:10,exerciseId:1,exerciseName:"Sentadilla",registrationType:"REPETITIONS",sets:[{id:101,setNumber:1,repetitions:6,completed:false}]}]};
  let active=0,maxActive=0,writes=0,releaseFirst;
  const delay = new Promise(resolve => {releaseFirst=resolve;});
  for (const client of [page,other]) {
    await seedTrainingApp(client,{hasPlan:false});
    await client.route("**/api/training/sessions**", async route => {
      if (route.request().method() === "GET") return route.fulfill({json:new URL(route.request().url()).pathname.endsWith("/20") ? server : {items:[server]}});
      const payload=route.request().postDataJSON(); writes++; active++; maxActive=Math.max(maxActive,active);
      if(writes === 1) await delay;
      if(payload.version !== server.version) {active--; return route.fulfill({status:409,json:{code:"CONFLICT",message:"Otra versión guardada"}});}
      server={...server,...payload,version:server.version+1,exercises:payload.exercises.map((ex,index)=>({...ex,id:10+index,exerciseName:"Sentadilla",sets:ex.sets.map((set,i)=>({...set,id:101+i}))}))};
      active--; await route.fulfill({json:server});
    });
    await client.goto("/entrenamiento/dia");
    await client.getByRole("button",{name:"Continuar Compartida",exact:true}).click();
    await expect(client.getByLabel("Repeticiones",{exact:true}).first()).toHaveValue("6");
  }
  const reps=page.getByLabel("Repeticiones",{exact:true}).first();
  await reps.fill("8"); await expect.poll(()=>writes).toBe(1);
  await reps.fill("9"); releaseFirst();
  await expect.poll(()=>server.exercises[0].sets[0].repetitions).toBe(9);
  await expect(reps).toHaveValue("9"); expect(maxActive).toBe(1); expect(writes).toBe(2);
  const otherReps=other.getByLabel("Repeticiones",{exact:true}).first();
  await otherReps.fill("10");
  await expect(other.getByRole("region",{name:"Comparar sesión y borrador"})).toBeVisible();
  await expect(otherReps).toHaveValue("10"); expect(writes).toBe(3);
  await other.getByRole("button",{name:"Reaplicar mi borrador",exact:true}).click();
  await expect.poll(()=>server.exercises[0].sets[0].repetitions).toBe(10);
  expect(writes).toBe(4); expect(server.id).toBe(20); expect(server.exercises[0].sets[0].id).toBe(101);
  await other.close();
});
