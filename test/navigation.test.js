import test from "node:test";
import assert from "node:assert/strict";
import { isNavItemActive, navItems } from "../src/config/app.js";

test("Registrar is the only navigation entry for recipes and catalog flows", () => {
  assert.equal(navItems.some((item) => item.id === "recipes"), false);
  const register = navItems.find((item) => item.id === "scanner");
  assert.ok(register);
  assert.equal(isNavItemActive(register, "scanner"), true);
  assert.equal(isNavItemActive(register, "my-foods"), true);
  assert.equal(isNavItemActive(register, "recipes"), true);
  assert.equal(isNavItemActive(register, "configure"), true);
});
