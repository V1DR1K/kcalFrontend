import test from "node:test";
import assert from "node:assert/strict";
import { decimalNumber, normalizeDecimalInput } from "../src/utils/decimal.js";

test("accepts comma and dot decimal separators and validates two decimals", () => {
  assert.equal(normalizeDecimalInput("42,555"), "42.555");
  assert.ok(Number.isNaN(decimalNumber("42,555")));
  assert.equal(normalizeDecimalInput("42.5"), "42.5");
  assert.equal(decimalNumber("0,5"), 0.5);
});

test("keeps an incomplete decimal editable", () => {
  assert.equal(normalizeDecimalInput("42,"), "42.");
  assert.ok(Number.isNaN(decimalNumber(".")));
});

test("does not turn negatives or pasted invalid text into positive quantities", () => {
 assert.equal(normalizeDecimalInput("-1"), "-1"); assert.equal(decimalNumber("-1"), -1);
 for (const value of ["1abc", "1.2.3", "1e3", "1+2", "", "--1"]) assert.ok(Number.isNaN(decimalNumber(value)));
 assert.equal(decimalNumber("12,50"), 12.5); assert.equal(decimalNumber("0"), 0);
});
