import test from "node:test";
import assert from "node:assert/strict";
import { isNavItemActive, navItems, trainingNavItems } from "../src/config/app.js";

test("Registrar is the only navigation entry for recipes and catalog flows", () => {
  assert.equal(navItems.some((item) => item.id === "recipes"), false);
  const register = navItems.find((item) => item.id === "scanner");
  assert.ok(register);
  assert.equal(isNavItemActive(register, "scanner"), true);
  assert.equal(isNavItemActive(register, "my-foods"), true);
  assert.equal(isNavItemActive(register, "recipes"), true);
  assert.equal(isNavItemActive(register, "configure"), true);
});

test("separa Mi perfil de Mis ejercicios en entrenamiento", () => {
  const profileItems = trainingNavItems.filter((item) => item.id === "profile" || item.id === "training-profile");
  assert.deepEqual(profileItems.map((item) => item.label), ["Perfil", "Mis ejercicios"]);
  assert.equal(profileItems[1].mobileLabel, "Mis ejercicios");
});
