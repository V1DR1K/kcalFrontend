import test from "node:test";
import assert from "node:assert/strict";
import { shiftDate, today } from "../src/utils/format.js";

test("uses the local calendar date instead of the UTC date", () => {
  assert.equal(today(new Date("2026-07-24T00:30:00Z")), "2026-07-23");
});

test("shifts dates without converting them to UTC", () => {
  assert.equal(shiftDate("2026-07-23", 1), "2026-07-24");
});
