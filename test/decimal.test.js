import test from "node:test";
import assert from "node:assert/strict";
import { decimalNumber, normalizeDecimalInput } from "../src/utils/decimal.js";

test("accepts comma and dot decimal separators and keeps two decimals", () => {
  assert.equal(normalizeDecimalInput("42,555"), "42.55");
  assert.equal(normalizeDecimalInput("42.5"), "42.5");
  assert.equal(decimalNumber("0,5"), 0.5);
});

test("keeps an incomplete decimal editable", () => {
  assert.equal(normalizeDecimalInput("42,"), "42.");
  assert.ok(Number.isNaN(decimalNumber(".")));
});
