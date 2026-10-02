import { test, expect } from "@playwright/test";

async function seedAnonymousSession(page) {
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message: "No hay una sesión activa." }),
  }));
  await page.route("**/api/auth/refresh", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message: "La sesión de renovación no es válida." }),
  }));
  await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 204 }));
}

test("renders the public landing and links to account access", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ScaleGrams/i);
  await expect(page.getByRole("heading", { name: /tu plan, en contexto/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /una foto te da un punto de partida/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /entrená con estructura/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /cada kilómetro también cuenta/i })).toBeVisible();
  await expect(page.locator(".landing-hero").getByRole("link", { name: /ingresar a scalegrams/i })).toHaveAttribute("href", "/ingresar");
  await expect(page.getByRole("link", { name: /entender la estimación/i })).toHaveAttribute("href", "#capacidad-photo");
  await expect(page.getByRole("link", { name: /saltar al contenido/i })).toHaveAttribute("href", "#landing-title");
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
  await seedAnonymousSession(page);
  await page.goto("/ingresar");
  await expect(page).toHaveTitle("Ingresar | ScaleGrams");
  await expect(page.getByText("ScaleGrams", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Usuario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /volver a scalegrams/i })).toHaveAttribute("href", "/");
});

test("announces a recoverable authentication error", async ({ page }) => {
  await seedAnonymousSession(page);
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message: "Email o contraseña incorrectos." }),
  }));
  await page.goto("/ingresar");
  await page.getByRole("textbox", { name: "Usuario" }).fill("persona");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.locator(".form-error")).toContainText("Email o contraseña incorrectos.");
});

test("starts the installed app at the session bootstrap route", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  expect((await manifestResponse.json()).start_url).toBe("/ingresar");

  await page.route("**/api/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({}),
  }));
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 1, username: "alex", fullName: "Alex", email: "alex@example.com" }),
  }));

  await page.goto("/ingresar");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "Día", exact: true }).first()).toBeVisible();
});

test("redirects an older standalone install from the legacy root start path", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : nativeMatchMedia(query);
  });
  await page.route("**/api/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({}),
  }));
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 1, username: "alex", fullName: "Alex", email: "alex@example.com" }),
  }));

  await page.goto("/");
  await expect(page).toHaveURL(/\/nutricion\/dia$/);
  await expect(page.locator(".app-shell")).toBeVisible();
});

test("keeps a recoverable state when session bootstrap loses the network", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.abort());
  await page.goto("/ingresar");

  await expect(page.getByRole("heading", { name: "No pudimos comprobar tu sesión" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Usuario" })).not.toBeVisible();
});

test("SG028/029 anonymous reload has no expiry warning and password toggling preserves input", async ({page}) => {
  await seedAnonymousSession(page); await page.goto("/ingresar");
  await expect(page.getByRole("heading",{name:"Ingresar a ScaleGrams",exact:true})).toBeVisible();
  await expect(page.getByText("Tu sesión venció. Volvé a ingresar.",{exact:true})).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("button",{name:"Ingresar",exact:true})).toBeVisible();
  await expect(page.getByText("Tu sesión venció. Volvé a ingresar.",{exact:true})).toHaveCount(0);
  const password=page.getByLabel("Contraseña",{exact:true}); await password.fill("Texto de prueba");
  await page.getByRole("button",{name:"Mostrar contraseña",exact:true}).click();
  await expect(password).toHaveAttribute("type","text"); await expect(password).toHaveValue("Texto de prueba"); await expect(password).toBeFocused();
  await page.getByRole("button",{name:"Ocultar contraseña",exact:true}).click(); await expect(password).toHaveAttribute("type","password"); await expect(password).toHaveValue("Texto de prueba");
});
test("SG028 reports expiration after a previously authenticated session", async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem("scalegrams.auth.session-seen","true"));
  await seedAnonymousSession(page); await page.goto("/ingresar");
  await expect(page.getByText("Tu sesión venció. Volvé a ingresar.",{exact:true})).toBeVisible();
});

test("SG008 stable routes survive reload and browser back/forward", async ({page}) => {
  await page.route("**/api/**", route => route.fulfill({json: new URL(route.request().url()).pathname === "/api/auth/me" ? {id:1,username:"test"} : {days:[],items:[],macros:[],meals:[]} }));
  await page.goto("/nutricion/historial"); await expect(page.getByRole("heading",{name:"Historial",exact:true})).toBeVisible(); await expect(page).toHaveTitle("Historial | ScaleGrams");
  await page.reload(); await expect(page.getByRole("heading",{name:"Historial",exact:true})).toBeVisible();
  await page.goto("/entrenamiento/cardio"); await expect(page.getByRole("heading",{name:"Cardio",exact:true})).toBeVisible();
  await page.goBack(); await expect(page.getByRole("heading",{name:"Historial",exact:true})).toBeVisible();
  await page.goForward(); await expect(page.getByRole("heading",{name:"Cardio",exact:true})).toBeVisible();
});
test("SG008 returns to the protected internal destination after login", async ({page}) => {
  await seedAnonymousSession(page);
  await page.route("**/api/**",route => route.fulfill({json:{items:[],days:[],meals:[],macros:[]}}));
  await page.route("**/api/auth/me",route => route.fulfill({status:401,json:{message:"Sin sesión"}}));
  await page.route("**/api/auth/refresh",route => route.fulfill({status:401,json:{}}));
  await page.route("**/api/auth/login",route => route.fulfill({json:{user:{id:1,username:"test"}}}));
  await page.goto("/entrenamiento/cardio"); await expect(page).toHaveURL(/\/ingresar\?retorno=/);
  await page.getByLabel("Usuario",{exact:true}).fill("test"); await page.getByLabel("Contraseña",{exact:true}).fill("password"); await page.getByRole("button",{name:"Ingresar",exact:true}).click();
  await expect(page).toHaveURL(/\/entrenamiento\/cardio$/); await expect(page.getByRole("heading",{name:"Cardio",exact:true})).toBeVisible();
});
test("SG031 landing chapter links target their own topic",async({page}) => {
  await page.goto("/");
  for(const [name,id] of [["Ver el registro diario","day"],["Entender la estimación","photo"],["Explorar tus sesiones","training"],["Ver el control de cardio","cardio"]]) {
    const link=page.getByRole("link",{name:new RegExp(name)}); await expect(link).toHaveAttribute("href",`#capacidad-${id}`); await link.click(); await expect(page).toHaveURL(new RegExp(`#capacidad-${id}$`)); await expect(page.locator(`#capacidad-${id}`)).toBeInViewport();
  }
});
