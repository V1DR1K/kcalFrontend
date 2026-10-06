import { APP_ROUTES } from "./page-metadata.js";

export { APP_ROUTES };
export function routeAtPath(path) {
  const route = APP_ROUTES.find(([, , pathname]) => pathname === path.replace(/\/$/, ""));
  if (route) return { mode: route[0], page: route[1] };
  const food = path.match(/^\/nutricion\/alimentos\/([1-9]\d*)\/registrar\/?$/);
  return food ? { mode: "nutrition", page: "configure", foodId: Number(food[1]) } : null;
}
export function routePath(mode, page, foodId) {
  if (page === "login" || page === "register") return "/ingresar";
  if (page === "configure" && Number.isSafeInteger(Number(foodId)) && Number(foodId) > 0) return `/nutricion/alimentos/${foodId}/registrar`;
  return APP_ROUTES.find(([routeMode, routePage]) => routeMode === mode && routePage === page)?.[2] || (mode === "training" ? "/entrenamiento/dia" : "/nutricion/dia");
}
export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://scalegrams.internal");
    if (url.origin !== "https://scalegrams.internal" || !routeAtPath(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}
