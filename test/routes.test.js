import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_ROUTES, routeAtPath, routePath, safeReturnPath } from "../src/app/routes.js";
test("every application page has a reversible stable route", () => {
  for (const [mode, page, path] of APP_ROUTES) { assert.deepEqual(routeAtPath(path), {mode,page}); assert.equal(routePath(mode,page),path); }
  assert.deepEqual(routeAtPath("/nutricion/alimentos/42/registrar"),{mode:"nutrition",page:"configure",foodId:42});
});
test("login return accepts only known internal application destinations", () => {
  assert.equal(safeReturnPath("/entrenamiento/cardio?compartir=abc"),"/entrenamiento/cardio?compartir=abc");
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/ingresar", "/", "/desconocida"]) assert.equal(safeReturnPath(path),null);
});
