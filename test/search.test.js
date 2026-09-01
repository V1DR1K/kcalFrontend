import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText } from "../src/utils/search.js";

test("normalizes case, accents, and whitespace for search", () => {
  assert.equal(normalizeSearchText("  CAFÉ   con  LECHE "), "cafe con leche");
  assert.equal(normalizeSearchText("NiÑo"), "nino");
  assert.equal(normalizeSearchText("maíz"), "maiz");
});

test("normalizes empty and null search values", () => {
  assert.equal(normalizeSearchText("   "), "");
  assert.equal(normalizeSearchText(null), "");
});
